import { A } from '@ember/array';
import EmberObject, { action, computed } from '@ember/object';
import { later } from '@ember/runloop';
import { waitFor } from '@ember/test-waiters';
import { all, restartableTask, task, timeout } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import File from 'ember-osf-web/models/file';
import Node from 'ember-osf-web/models/node';

import GuidNodeIQBRIMS from './controller';

export default class IQBRIMSFileBrowser extends EmberObject {
    static readonly FILES_TXT = '.files.txt';

    folderName: string | null = null;
    owner: GuidNodeIQBRIMS | null = null;

    filter = '';
    sort = 'name';
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

    @restartableTask
    @waitFor
    async updateFilter(filter: string) {
        await timeout(250);
        this.setProperties({ filter });
    }

    @task
    @waitFor
    async flash(item: File, message: string, type: string = 'success', duration: number = 2000) {
        item.set('flash', { message, type });
        await timeout(duration);
        item.set('flash', null);
    }

    @task
    @waitFor
    async addFile(id: string) {
        const allFiles = this.get('allFiles');
        if (!allFiles || !this.owner) {
            return;
        }
        const duplicate = allFiles.findBy('id', id);

        const file = await this.owner.get('store')
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
        taskFor(this.flash).perform(file, intl.t('file_browser.file_added'));
    }

    @task
    @waitFor
    async deleteFile(file: File) {
        if (!this.owner) {
            return;
        }
        try {
            await file.destroyRecord();
            await taskFor(this.flash).perform(file, this.owner.get('intl').t('file_browser.file_deleted'), 'danger');
            const allFiles = this.get('allFiles');
            if (!allFiles) {
                return;
            }
            allFiles.removeObject(file);
            this.notifyChange();
        } catch (e) {
            await taskFor(this.flash).perform(file, this.owner.get('intl').t('file_browser.delete_failed'), 'danger');
        }
    }

    @task
    @waitFor
    async deleteFiles(files: File[]) {
        await all(files.map(file => taskFor(this.deleteFile).perform(file)));
    }

    @task
    @waitFor
    async moveFile(file: File, node: Node) {
        if (!this.owner) {
            return;
        }
        try {
            await file.move(node);
            await taskFor(this.flash).perform(file, this.owner.get('intl').t('file_browser.successfully_moved'));
            const allFiles = this.get('allFiles');
            if (!allFiles) {
                return;
            }
            allFiles.removeObject(file);
            this.notifyChange();
        } catch (ex) {
            this.owner.get('toast').error(this.owner.get('intl').t('move_to_project.could_not_move_file'));
        }
    }

    @task
    @waitFor
    async renameFile(
        file: File,
        name: string,
        conflict?: string,
        conflictingFile?: File,
    ) {
        if (!this.owner) {
            return;
        }

        try {
            await file.rename(name, conflict);

            // intentionally not yielded
            taskFor(this.flash).perform(file, this.owner.get('intl').t('file_browser.successfully_renamed'));

            if (conflictingFile) {
                await taskFor(this.flash).perform(conflictingFile, this.owner.get('intl').t('file_browser.file_replaced'), 'danger');
                const allFiles = this.get('allFiles');
                if (!allFiles) {
                    return;
                }
                allFiles.removeObject(conflictingFile);
            }
            this.notifyChange();
        } catch (ex) {
            taskFor(this.flash).perform(file, this.owner.get('intl').t('file_browser.rename_failed'), 'danger');
        }
    }

    @computed('owner.workingDirectory.files.[]')
    get targetDirectory(): File | undefined {
        if (!this.owner) {
            return undefined;
        }
        const defaultStorage = this.owner.get('workingDirectory');
        if (!defaultStorage) {
            return undefined;
        }
        const storageFiles = defaultStorage.get('files');
        const files = storageFiles.filter(f => f.name === this.folderName);
        if (files.length === 0) {
            this.createTargetDirectory(defaultStorage);
            return undefined;
        }
        return files[0];
    }

    createTargetDirectory(defaultStorage: File | undefined) {
        if (!defaultStorage) {
            return;
        }
        if (this.newFolderRequest || !this.owner || !this.folderName) {
            return;
        }
        const newFolderUrl = defaultStorage.get('links').new_folder;
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

    @computed('owner.gdProvider.files.[]')
    get gdTargetDirectory(): File | undefined | null {
        if (!this.owner) {
            return undefined;
        }
        const gdProvider = this.owner.get('gdProvider');
        if (!gdProvider) {
            return undefined;
        }
        const storageFiles = gdProvider.get('files');
        const files = storageFiles.filter(f => f.name === this.folderName);
        if (files.length === 0) {
            return undefined;
        }
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
    get files(): File[] | null {
        const filter: string = this.get('filter');
        const sort: string = this.get('sort');

        let _results = this.get('allFiles');
        if (!_results) {
            return null;
        }
        let results = _results.slice();

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
    get canEdit(): boolean {
        return true;
    }

    @action
    async openFile(file: File, show: string) {
        if (!this.owner) {
            return;
        }
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
