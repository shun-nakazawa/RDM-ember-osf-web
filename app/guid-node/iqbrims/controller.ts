import { action, computed } from '@ember-decorators/object';
import { reads } from '@ember-decorators/object/computed';
import { service } from '@ember-decorators/service';
import Controller from '@ember/controller';
import EmberError from '@ember/error';

import DS from 'ember-data';

import { later } from '@ember/runloop';

import I18N from 'ember-i18n/services/i18n';
import File from 'ember-osf-web/models/file';
import FileProviderModel from 'ember-osf-web/models/file-provider';
import IQBRIMSStatusModel from 'ember-osf-web/models/iqbrims-status';
import Node from 'ember-osf-web/models/node';
import UserModel from 'ember-osf-web/models/user';
import Analytics from 'ember-osf-web/services/analytics';
import CurrentUser from 'ember-osf-web/services/current-user';
import StatusMessages from 'ember-osf-web/services/status-messages';
import Toast from 'ember-toastr/services/toast';

import IQBRIMSFileBrowser from './file-browser';

export default class GuidNodeIQBRIMS extends Controller {
    @service toast!: Toast;
    @service i18n!: I18N;
    @service statusMessages!: StatusMessages;
    @service analytics!: Analytics;
    @service currentUser!: CurrentUser;

    @reads('model.taskInstance.value')
    node?: Node;

    queryParams = ['tab'];
    tab?: string;

    submitting = false;
    submitted = false;

    statusCache?: DS.PromiseObject<IQBRIMSStatusModel>;
    manuscriptFiles = new IQBRIMSFileBrowser(this, '最終原稿・組図');
    dataFiles = new IQBRIMSFileBrowser(this, '生データ');
    checklistFiles = new IQBRIMSFileBrowser(this, 'チェックリスト');
    newFolderRequest?: object;
    workingFolderName = 'IQB-RIMS Temporary files';

    @computed('manuscriptFiles.loading', 'dataFiles.loading', 'checklistFiles.loading')
    get loadingForDeposit(): boolean {
        return this.manuscriptFiles.get('loading') || this.dataFiles.get('loading')
               || this.checklistFiles.get('loading');
    }

    @computed('manuscriptFiles.loading')
    get loadingForCheck(): boolean {
        return this.manuscriptFiles.get('loading');
    }

    @computed('modeEdit', 'modeDeposit', 'loadingForDeposit')
    get panelStatusForDeposit(): string {
        if (!this.modeEdit) {
            return 'loaded';
        }
        return this.loadingForDeposit ? 'loading' : 'loaded';
    }

    @computed('modeEdit', 'modeDeposit', 'loadingForCheck')
    get panelStatusForCheck(): string {
        if (!this.modeEdit) {
            return 'loaded';
        }
        return this.loadingForCheck ? 'loading' : 'loaded';
    }

    @computed('status.state')
    get flowableTaskUrl() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        return status.taskUrl;
    }

    @action
    laboChanged(this: GuidNodeIQBRIMS, laboId: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('laboId', laboId);
        this.notifyPropertyChange('isFilled');
        status.save();
    }

    @action
    valueChanged(this: GuidNodeIQBRIMS) {
        if (!this.status) {
            return;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.save();
    }

    @computed('status.state')
    get laboId() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return null;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.laboId) {
            return '';
        }
        return status.laboId;
    }

    @computed('laboId', 'laboList')
    get laboName() {
        const { laboId, laboList } = this;
        if (!laboId || !laboList) {
            return undefined;
        }
        const laboNames = laboList.filter(o => o.id === laboId).map(o => o.text);
        if (laboNames.length === 0) {
            return null;
        }
        return laboNames[0];
    }

    @action
    submit(this: GuidNodeIQBRIMS) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        this.set('submitting', true);
        const status = this.status.content as IQBRIMSStatusModel;
        const prevState = status.get('state');
        if (this.modeDeposit) {
            status.set('state', 'deposit');
        } else if (this.modeCheck) {
            status.set('state', 'check');
        }
        status.save().then(() => {
            const mfiles = this.manuscriptFiles.files;
            if (mfiles != null) {
                mfiles.forEach(f => {
                    f.moveOnCurrentProject('iqbrims', '/最終原稿・組図/');
                });
            }
            if (this.modeDeposit) {
                const dfiles = this.dataFiles.files;
                if (dfiles != null) {
                    dfiles.forEach(f => {
                        f.moveOnCurrentProject('iqbrims', '/生データ/');
                    });
                }
                const cfiles = this.checklistFiles.files;
                if (cfiles != null) {
                    cfiles.forEach(f => {
                        f.moveOnCurrentProject('iqbrims', '/チェックリスト/');
                    });
                }
            }
            let url = window.location.href;
            if (url.endsWith('/')) {
                url = url.substring(0, url.length - 1);
            }
            const pos = url.lastIndexOf('/');
            if (pos > 0) {
                url = url.substring(0, pos + 1);
            }
            this.set('submitting', false);
            this.set('submitted', true);
            window.location.hash = '';
            window.location.reload();
        }).catch(() => {
            const message = this.i18n.t('iqbrims.failed_to_submit');
            this.toast.error(message);
            status.set('state', prevState);
            this.set('submitting', false);
        });
    }

    @computed('manuscriptFiles.filled', 'dataFiles.filled', 'checklistFiles.filled')
    get hasChangedFiles() {
        return this.manuscriptFiles.filled || this.dataFiles.filled || this.checklistFiles.filled;
    }

    @computed('status.{state,isDirectlySubmitData}', 'manuscriptFiles.hasError',
        'dataFiles.hasError', 'checklistFiles.hasError')
    get isFilled() {
        if (!this.status) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (this.modeDeposit) {
            if (!status.journalName || status.journalName.length === 0) {
                return false;
            }
            if (!status.acceptedDate || status.acceptedDate.length === 0) {
                return false;
            }
            if (!status.isDirectlySubmitData && this.dataFiles.hasError) {
                return false;
            }
            if (this.checklistFiles.hasError) {
                return false;
            }
        }
        if (!status.laboId || status.laboId.length === 0) {
            return false;
        }
        if (this.manuscriptFiles.hasError) {
            return false;
        }
        return true;
    }

    @computed('node.title')
    get paperTitle() {
        if (!this.node) {
            return undefined;
        }
        return this.node.title;
    }

    @computed('status.state')
    get acceptedDate() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return null;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.acceptedDate) {
            return null;
        }
        return new Date(status.acceptedDate);
    }

    set acceptedDate(v: Date | null) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('acceptedDate', v === null ? '' : v.toISOString());
        this.notifyPropertyChange('isFilled');
    }

    @computed('status.state')
    get journalName() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.journalName) {
            return '';
        }
        return status.journalName;
    }

    set journalName(v: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('journalName', v);
        this.notifyPropertyChange('isFilled');
    }

    @computed('status.state')
    get doi() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.doi) {
            return '';
        }
        return status.doi;
    }

    set doi(v: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('doi', v);
    }

    @computed('status.state')
    get publishDate() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return null;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.publishDate) {
            return null;
        }
        return new Date(status.publishDate);
    }

    set publishDate(v: Date | null) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('publishDate', v === null ? '' : v.toISOString());
    }

    @computed('status.state')
    get volume() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.volume) {
            return '';
        }
        return status.volume;
    }

    set volume(v: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('volume', v);
    }

    @computed('status.state')
    get pageNumber() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.pageNumber) {
            return '';
        }
        return status.pageNumber;
    }

    set pageNumber(v: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('pageNumber', v);
    }

    @computed('status.isDirectlySubmitData')
    get isDirectlySubmitData() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        return status.isDirectlySubmitData;
    }

    set isDirectlySubmitData(v: boolean) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('isDirectlySubmitData', v);
    }

    @computed('status.state')
    get workflowOverallState() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowOverallState) {
            return 'not_submitted';
        }
        return status.workflowOverallState;
    }

    @computed('status.state')
    get workflowPaperState() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowPaperState) {
            return 'not_submitted';
        }
        return status.workflowPaperState;
    }

    @computed('status.state')
    get workflowRawState() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowRawState) {
            return 'not_submitted';
        }
        return status.workflowRawState;
    }

    @computed('status.state')
    get workflowChecklistState() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowChecklistState) {
            return 'not_submitted';
        }
        return status.workflowChecklistState;
    }

    @computed('status.state')
    get isPaperWritable() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return true;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowPaperPermissions) {
            return true;
        }
        return status.workflowPaperPermissions.includes('WRITABLE');
    }

    @computed('status.state')
    get isRawWritable() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return true;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowRawPermissions) {
            return true;
        }
        return status.workflowRawPermissions.includes('WRITABLE');
    }

    @computed('status.state')
    get isChecklistWritable() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return true;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.workflowChecklistPermissions) {
            return true;
        }
        return status.workflowChecklistPermissions.includes('WRITABLE');
    }

    @computed('node.contributors.[]')
    get owner() {
        if (!this.node) {
            return undefined;
        }
        const owners = this.node.contributors.filter(c => {
            const user = c.users.content as UserModel;
            return user.id === this.currentUser.currentUserId;
        });
        if (owners.length === 0) {
            return undefined;
        }
        return owners[0].users.content as UserModel;
    }

    @computed('node.contributors.[]')
    get otherContributors() {
        if (!this.node) {
            return undefined;
        }
        const conts = this.node.contributors.filter(c => {
            const user = c.users.content as UserModel;
            return user.id !== this.currentUser.currentUserId;
        });
        return conts.map(c => c.users.content as UserModel);
    }

    @computed('node.contributors.[]')
    get contributorEmails() {
        if (!this.node) {
            return null;
        }
        const usernames = this.node.contributors.map(c => {
            const user = c.users.content as UserModel;
            return user.fullName;
        });
        return [`(Email address of ${usernames.join(',')})`];
    }

    @computed('status.laboList')
    get laboList() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return [];
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.laboList) {
            return [];
        }
        const labos = status.laboList.map(labo => ({
            id: labo.substring(0, labo.indexOf(':')),
            text: labo.substring(labo.indexOf(':') + 1),
        }));
        return labos;
    }

    @computed('status.state')
    get modeUnknown() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return true;
        }
        return false;
    }

    @computed('status.state')
    get modeAdmin() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        return status.isAdmin;
    }

    @computed('status.state')
    get modeEdit() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (this.submitting) {
            return true;
        }
        if ((status.state === 'deposit' || status.state === 'check')
            && window.location.hash !== '#edit') {
            return false;
        }
        return true;
    }

    @computed('status.state')
    get modeDeposit() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (status.state === 'deposit') {
            return true;
        }
        if (status.edit === 'deposit') {
            return true;
        }
        return false;
    }

    @computed('status.state')
    get modeCheck() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (status.state === 'check') {
            return true;
        }
        if (status.edit === 'check') {
            return true;
        }
        return false;
    }

    @computed('status.state')
    get isNotSubmitted() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        return status.state === 'initialized';
    }

    get gdProvider(): FileProviderModel | null | undefined {
        if (!this.node) {
            return undefined;
        }
        if (!this.node.files.get('isFulfilled')) {
            return undefined;
        }
        const providers = this.node.files.filter(f => f.name === 'iqbrims');
        if (providers.length === 0) {
            return null;
        }
        return providers[0];
    }

    @computed('node.files.[]')
    get defaultStorage(): FileProviderModel | undefined {
        if (!this.node) {
            return undefined;
        }
        if (!this.node.files.get('isFulfilled')) {
            return undefined;
        }
        const providers = this.node.files.filter(f => f.name === 'osfstorage');
        return providers[0];
    }

    @computed('defaultStorage.files.[]')
    get workingDirectory(): File | undefined {
        const provider = this.defaultStorage;
        if (!provider) {
            return undefined;
        }
        return this.findWorkingDirectory(provider);
    }

    findWorkingDirectory(defaultStorage: FileProviderModel) {
        if (!defaultStorage.files.isFulfilled && !defaultStorage.files.isRejected) {
            later(() => {
                this.findWorkingDirectory(defaultStorage);
            }, 500);
            return undefined;
        }
        const files = defaultStorage.files.filter(f => f.name === this.workingFolderName);
        if (files.length === 0) {
            this.createWorkingDirectory(defaultStorage);
            return undefined;
        }
        this.notifyPropertyChange('workingDirectory');
        this.notifyPropertyChange('gdProvider');
        this.manuscriptFiles.rejectExtensions = ['.tiff', '.png', '.jpg', '.jpeg'];
        this.dataFiles.acceptExtensions = ['.zip', '.xls', '.xlsx'];
        this.checklistFiles.acceptExtensions = ['.pdf'];
        return files[0];
    }

    createWorkingDirectory(defaultStorage: FileProviderModel) {
        if (this.newFolderRequest) {
            return;
        }
        const newFolderUrl = defaultStorage.links.new_folder;
        this.newFolderRequest = this.currentUser.authenticatedAJAX({
            url: `${newFolderUrl}&name=${encodeURIComponent(this.workingFolderName)}`,
            type: 'PUT',
        }).then(() => {
            window.location.reload();
        });
    }

    @computed('node')
    get status(): DS.PromiseObject<IQBRIMSStatusModel> | undefined {
        if (this.statusCache) {
            return this.statusCache;
        }
        if (!this.node) {
            return undefined;
        }
        this.statusCache = this.store.findRecord('iqbrims-status', this.node.id);
        return this.statusCache!;
    }

    @computed('status.hasDirtyAttributes', 'submitted')
    get isPageDirty() {
        if (this.get('submitted')) {
            return false;
        }
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        const value = status.hasDirtyAttributes;
        return value;
    }

    @action
    startDeposit(this: GuidNodeIQBRIMS) {
        window.location.href = '?edit=deposit';
        this.notifyPropertyChange('modeCheck');
        this.notifyPropertyChange('modeDeposit');
        this.notifyPropertyChange('modeEdit');
    }

    @action
    startCheck(this: GuidNodeIQBRIMS) {
        window.location.href = '?edit=check';
        this.notifyPropertyChange('modeCheck');
        this.notifyPropertyChange('modeDeposit');
        this.notifyPropertyChange('modeEdit');
    }

    @action
    startEdit(this: GuidNodeIQBRIMS) {
        window.location.hash = '#edit';
        window.location.reload();
    }

    @action
    buildManuscriptFileUrl(files: File[]) {
        return this.manuscriptFiles.buildUrl(files);
    }

    @action
    buildDataFileUrl(files: File[]) {
        return this.dataFiles.buildUrl(files);
    }

    @action
    buildChecklistFileUrl(files: File[]) {
        return this.checklistFiles.buildUrl(files);
    }

    @computed('tab')
    get activeTab() {
        return this.tab ? this.tab : 'IQBRIMS__overflow_view_paper';
    }

    @action
    changeTab(this: GuidNodeIQBRIMS, activeId: string) {
        this.set('tab', activeId === 'IQBRIMS__overflow_view_paper' ? undefined : activeId);
    }
}

declare module '@ember/controller' {
  interface Registry {
    'guid-node/iqbrims': GuidNodeIQBRIMS;
  }
}
