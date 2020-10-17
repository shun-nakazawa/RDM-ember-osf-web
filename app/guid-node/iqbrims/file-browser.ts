import { A } from '@ember/array';
import EmberObject, { action, computed } from '@ember/object';
import { later } from '@ember/runloop';
import { all, task, timeout } from 'ember-concurrency';

import File from 'ember-osf-web/models/file';
import FileProviderModel from 'ember-osf-web/models/file-provider';
import Node from 'ember-osf-web/models/node';

import GuidNodeIQBRIMS from './controller';

export default class IQBRIMSFileBrowser extends EmberObject {
    static readonly FILES_TXT = '.files.txt';

    folderName: string;
    owner: GuidNodeIQBRIMS;

    filter: string = this.filter || '';
    sort: string = this.sort || 'name';
    newFolderRequest?: object;
    gdLoading = true;
    gdEmpty = false;
    filled = false;
    hasError = false;
    rejectedFiles: string[] = [];
    acceptExtensions: string[] | null = null;
    rejectExtensions: string[] | null = null;
    cachedFiles: File[] | undefined = undefined;
    indexFile: File | null = null;

    dropzoneOptions = {
        createImageThumbnails: false,
        method: 'PUT',
        withCredentials: true,
        preventMultipleFiles: false,
        acceptDirectories: false,
        timeout: 1000 * 60 * 60 * 48,
        maxFilesize: null,
    };

    @computed('allFiles.[]')
    get loading(): boolean {
        if (!this.get('allFiles')) {
            return true;
        }
        return false;
    }

    updateFilter = task(function *(this: IQBRIMSFileBrowser, filter: string) {
        yield timeout(250);
        this.filter = filter;
    }).restartable();

    flash = task(function *(item: File, message: string, type: string = 'success', duration: number = 2000) {
        item.set('flash', { message, type });
        yield timeout(duration);
        item.set('flash', null);
    });

    addFile = task(function *(this: IQBRIMSFileBrowser, id: string) {
        const allFiles = this.get('allFiles');
        if (!allFiles) {
            return;
        }
        const duplicate = allFiles.findBy('id', id);

        const file = yield this.owner.get('store')
            .findRecord('file', id, duplicate ? {} : { adapterOptions: { query: { create_guid: 1 } } });

        if (duplicate) {
            allFiles.removeObject(duplicate);
        }

        allFiles.pushObject(file);
        this.notifyChange();

        if (duplicate) {
            return;
        }

        const intl = this.owner.get('intl');
        this.owner.get('toast').success(intl.t('file_browser.file_added_toast'));
        this.get('flash').perform(file, intl.t('file_browser.file_added'));
    });

    deleteFile = task(function *(this: IQBRIMSFileBrowser, file: File) {
        try {
            yield file.destroyRecord();
            yield this.get('flash').perform(file, this.owner.get('intl').t('file_browser.file_deleted'), 'danger');
            const allFiles = this.get('allFiles');
            if (!allFiles) {
                return;
            }
            allFiles.removeObject(file);
            this.notifyChange();
        } catch (e) {
            yield this.get('flash').perform(file, this.owner.get('intl').t('file_browser.delete_failed'), 'danger');
        }
    });

    deleteFiles = task(function *(this: IQBRIMSFileBrowser, files: File[]) {
        const deleteFile = this.get('deleteFile');

        yield all(files.map(file => deleteFile.perform(file)));
    });

    moveFile = task(function *(this: IQBRIMSFileBrowser, file: File, node: Node): IterableIterator<any> {
        try {
            yield file.move(node);
            yield this.get('flash').perform(file, this.owner.get('intl').t('file_browser.successfully_moved'));
            const allFiles = this.get('allFiles');
            if (!allFiles) {
                return;
            }
            allFiles.removeObject(file);
            this.notifyChange();
        } catch (ex) {
            this.owner.get('toast').error(this.owner.get('intl').t('move_to_project.could_not_move_file'));
        }
    });

    renameFile = task(function *(
        this: IQBRIMSFileBrowser,
        file: File,
        name: string,
        conflict?: string,
        conflictingFile?: File,
    ) {
        const flash = this.get('flash');

        try {
            yield file.rename(name, conflict);

            // intentionally not yielded
            flash.perform(file, this.owner.get('intl').t('file_browser.successfully_renamed'));

            if (conflictingFile) {
                yield flash.perform(conflictingFile, this.owner.get('intl').t('file_browser.file_replaced'), 'danger');
                const allFiles = this.get('allFiles');
                if (!allFiles) {
                    return;
                }
                allFiles.removeObject(conflictingFile);
            }
            this.notifyChange();
        } catch (ex) {
            yield this.get('flash').perform(file, this.owner.get('intl').t('file_browser.rename_failed'), 'danger');
        }
    });

    constructor(owner: GuidNodeIQBRIMS, folderName: string) {
        super();
        this.owner = owner;
        this.folderName = folderName;
    }

    @computed('owner.workingDirectory.files.[]')
    get targetDirectory(): File | undefined {
        if (!this.owner.workingDirectory) {
            return undefined;
        }
        return this.findTargetDirectory(this.owner.workingDirectory);
    }

    findTargetDirectory(defaultStorage: File) {
        if (!defaultStorage.files.isFulfilled && !defaultStorage.files.isRejected) {
            later(() => {
                this.findTargetDirectory(defaultStorage);
            }, 500);
            return undefined;
        }
        const files = defaultStorage.files.filter(f => f.name === this.folderName);
        if (files.length === 0) {
            this.createTargetDirectory(defaultStorage);
            return undefined;
        }
        this.notifyPropertyChange('allFiles');
        return files[0];
    }

    createTargetDirectory(defaultStorage: File) {
        if (this.newFolderRequest) {
            return;
        }
        const newFolderUrl = defaultStorage.links.new_folder;
        this.newFolderRequest = this.owner.currentUser.authenticatedAJAX({
            url: `${newFolderUrl}&name=${encodeURIComponent(this.folderName)}`,
            type: 'PUT',
        }).then(() => {
            window.location.reload();
        });
    }

    @computed('targetDirectory.files.[]')
    get allFiles(): File[] | undefined {
        if (!this.targetDirectory) {
            return undefined;
        }
        if (this.cachedFiles !== undefined) {
            return this.cachedFiles;
        }
        const dir = this.targetDirectory;
        later(async () => {
            const fileList = await dir.queryHasMany(
                'files',
                { 'page[size]': 1000 },
            );
            const files = fileList.filter(this.filterFiles);
            const indexFiles = fileList.filter(f => !this.filterFiles(f));
            this.set('indexFile', indexFiles.length > 0 ? indexFiles[0] : null);
            this.notifyFilled(files);
            this.cachedFiles = files;
            this.notifyPropertyChange('allFiles');
        }, 0);
        return undefined;
    }

    @computed('owner.gdProvider')
    get gdTargetDirectory(): File | undefined | null {
        if (this.owner.gdProvider === undefined) {
            return undefined;
        }
        if (this.owner.gdProvider === null) {
            this.set('gdLoading', false);
            return null;
        }
        return this.findGDTargetDirectory(this.owner.gdProvider);
    }

    findGDTargetDirectory(defaultStorage: FileProviderModel) {
        if (!defaultStorage.rootFolder.isFulfilled && !defaultStorage.rootFolder.isRejected) {
            later(() => {
                this.findGDTargetDirectory(defaultStorage);
                this.notifyPropertyChange('gdTargetDirectory');
            }, 500);
            return undefined;
        }
        const files = defaultStorage.rootFolder.files.filter(f => f.name === this.folderName);
        if (files.length === 0) {
            return undefined;
        }
        this.notifyPropertyChange('gdTargetDirectory');
        return files[0];
    }

    @computed('gdTargetDirectory.files.[]')
    get gdAllFiles(): File[] | undefined {
        if (this.gdTargetDirectory === undefined) {
            return undefined;
        }
        if (this.gdTargetDirectory === null) {
            this.set('gdLoading', false);
            this.set('gdEmpty', true);
            return [];
        }
        this.set('gdLoading', false);
        const dir = this.gdTargetDirectory;
        const files = dir.files.filter(this.filterFiles);
        this.set('gdEmpty', files.length === 0);
        return files;
    }

    @computed('allFiles.[]', 'filter', 'sort')
    get files(this: IQBRIMSFileBrowser): File[] | null {
        const filter: string = this.get('filter');
        const sort: string = this.get('sort');

        let results = this.get('allFiles');
        if (!results) {
            return null;
        }

        if (filter) {
            const filterLowerCase = filter.toLowerCase();
            results = results.filter(file => file.get('name').toLowerCase().includes(filterLowerCase));
        }

        if (sort) {
            const reverse: boolean = sort.slice(0, 1) === '-';

            results = A(results).sortBy(sort.slice(+reverse));

            if (reverse) {
                results = results.reverse();
            }
        }

        return results;
    }

    @computed('currentUser.currentUserId', 'user.id')
    get canEdit(this: IQBRIMSFileBrowser): boolean {
        return true;
    }

    @action
    async openFile(this: IQBRIMSFileBrowser, file: File, show: string) {
        const guid = file.get('guid') || await file.getGuid();

        this.owner.transitionToRoute('guid-file', guid, { queryParams: { show } });
    }

    buildUrl(files: File[]) {
        const { name } = files[0];
        const dir = this.targetDirectory;
        if (!dir) {
            return undefined;
        }
        return `${dir.links.upload}?${$.param({ name })}`;
    }

    notifyChange() {
        const files = this.allFiles;
        if (files == null) {
            this.notifyFilled([]);
        } else {
            this.notifyFilled(files);
        }
    }

    notifyFilled(files: File[]) {
        let rejectedFiles: string[] = [];
        if (files.length === 0) {
            this.set('filled', false);
        } else if (this.acceptExtensions != null) {
            const extensions = this.acceptExtensions;
            const rejecteds = files.filter(file => !extensions.includes(this.getExtension(file.get('name'))));
            this.set('filled', rejecteds.length === 0);
            rejectedFiles = rejecteds.map(file => file.get('name'));
        } else if (this.rejectExtensions != null) {
            const extensions = this.rejectExtensions;
            const rejecteds = files.filter(file => extensions.includes(this.getExtension(file.get('name'))));
            this.set('filled', rejecteds.length === 0);
            rejectedFiles = rejecteds.map(file => file.get('name'));
        } else {
            this.set('filled', true);
        }
        this.set('rejectedFiles', rejectedFiles);
        this.set('hasError', rejectedFiles.length > 0);
    }

    getExtension(filename: string) {
        if (filename == null) {
            return '';
        }
        const pos = filename.lastIndexOf('.');
        if (pos <= 0) {
            return filename;
        }
        return filename.substring(pos).toLowerCase();
    }

    filterFiles(f: File) {
        return f.name !== IQBRIMSFileBrowser.FILES_TXT;
    }
}
