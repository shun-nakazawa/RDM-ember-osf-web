import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'ember-get-config';
import Session from 'ember-simple-auth/services/session';

import { layout } from 'ember-osf-web/decorators/component';
import CurrentUser from 'ember-osf-web/services/current-user';

import template from './template';

const osfURL = config.OSF.url;

const {
    navbar: {
        useQuickfiles,
        useRegistrations,
        useSearch,
        useSupport,
        useDonate,
    },
} = config;

@layout(template)
@tagName('') // Don't wrap this component in a div
export default class XLinks extends Component {
    @service router!: any;
    @service session!: Session;
    @service currentUser!: CurrentUser;

    searchURL = `${osfURL}search/`;
    myProjectsURL = `${osfURL}myprojects/`;
    myRegistrationsURL = `${osfURL}myprojects/#registrations`;
    onLinkClicked: () => void = () => null;

    useNavQuickfiles: boolean = useQuickfiles;
    useNavRegistrations: boolean = useRegistrations;
    useNavSearch: boolean = useSearch;
    useNavSupport: boolean = useSupport;
    useNavDonate: boolean = useDonate;

    @computed('onInstitutions', 'router.currentRouteName')
    get supportURL() {
        return this.onInstitutions ? 'https://openscience.zendesk.com/hc/en-us/categories/360001550913' : 'support';
    }

    @computed('router.currentRouteName')
    get onInstitutions() {
        return this.router.currentRouteName === 'institutions';
    }
}
