import { action, computed } from '@ember-decorators/object';
import { reads } from '@ember-decorators/object/computed';
import { service } from '@ember-decorators/service';
import Controller from '@ember/controller';
import EmberError from '@ember/error';

import DS from 'ember-data';

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

    statusCache?: DS.PromiseObject<IQBRIMSStatusModel>;
    manuscriptFiles = new IQBRIMSFileBrowser(this, '最終原稿・組図(Draft)');
    dataFiles = new IQBRIMSFileBrowser(this, '生データ(Draft)');

    contributorType?: string;
    laboId?: string;

    @action
    contributorTypeChanged(this: GuidNodeIQBRIMS, contributorType: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('contributorType', contributorType);
    }

    @action
    laboChanged(this: GuidNodeIQBRIMS, laboId: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('laboId', laboId);
    }

    @action
    saveInput(this: GuidNodeIQBRIMS) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (this.modeDeposit) {
            status.set('state', 'deposit');
        } else if (this.modeCheck) {
            status.set('state', 'check');
        }
        status.save();
    }

    @action
    discardInput(this: GuidNodeIQBRIMS) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.rollbackAttributes();
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
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.acceptedDate) {
            return '';
        }
        return status.acceptedDate;
    }

    set acceptedDate(v: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('acceptedDate', v);
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
            return '';
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (!status.publishDate) {
            return '';
        }
        return status.publishDate;
    }

    set publishDate(v: string) {
        if (!this.status) {
            throw new EmberError('Illegal status');
        }
        const status = this.status.content as IQBRIMSStatusModel;
        status.set('publishDate', v);
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

    get laboList() {
        const labos = [];
        labos.push({ id: 'rna', text: 'RNA分野' });
        labos.push({ id: 'xxx', text: 'XXX分野' });
        labos.push({ id: 'yyy', text: 'YYY分野' });
        return labos;
    }

    @computed('status.state')
    get modeDeposit() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        if (window.location.hash === '#deposit') {
            return true;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (status.state === 'deposit') {
            return true;
        }
        return false;
    }

    @computed('status.state')
    get modeCheck() {
        if (!this.status || !this.status.get('isFulfilled')) {
            return false;
        }
        if (window.location.hash === '#check') {
            return true;
        }
        const status = this.status.content as IQBRIMSStatusModel;
        if (status.state === 'check') {
            return true;
        }
        return false;
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

    @action
    startDeposit(this: GuidNodeIQBRIMS) {
        this.set('modeDeposit', true);
        window.location.hash = '#deposit';
    }

    @action
    startCheck(this: GuidNodeIQBRIMS) {
        this.set('modeCheck', true);
        window.location.hash = '#check';
    }

    @action
    buildManuscriptFileUrl(files: File[]) {
        return this.manuscriptFiles.buildUrl(files);
    }

    @action
    buildDataFileUrl(files: File[]) {
        return this.dataFiles.buildUrl(files);
    }
}

declare module '@ember/controller' {
  interface Registry {
    'guid-node/iqbrims': GuidNodeIQBRIMS;
  }
}