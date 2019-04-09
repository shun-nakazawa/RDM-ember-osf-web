import { tagName } from '@ember-decorators/component';
import { computed } from '@ember-decorators/object';
import { service } from '@ember-decorators/service';
import Component from '@ember/component';
import config from 'ember-get-config';
import CurrentUser from 'ember-osf-web/services/current-user';
import defaultTo from 'ember-osf-web/utils/default-to';
import Session from 'ember-simple-auth/services/session';
import layout from './template';

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

@tagName('') // Don't wrap this component in a div
export default class XLinks extends Component {
    layout = layout;

    @service router!: any;
    @service session!: Session;
    @service currentUser!: CurrentUser;

    searchURL: string = defaultTo(this.searchURL, `${osfURL}search/`);
    myProjectsURL: string = defaultTo(this.myProjectsURL, `${osfURL}myprojects/`);
    myRegistrationsURL: string = defaultTo(this.myRegistrationsURL, `${osfURL}myprojects/#registrations`);
    onLinkClicked: () => void = defaultTo(this.onLinkClicked, () => null);

    useNavQuickfiles: boolean = useQuickfiles;
    useNavRegistrations: boolean = useRegistrations;
    useNavSearch: boolean = useSearch;
    useNavSupport: boolean = useSupport;
    useNavDonate: boolean = useDonate;

    @computed('router.currentRouteName')
    get supportURL() {
        return this.onInstitutions ? 'http://help.osf.io/m/institutions' : 'support';
    }

    @computed('router.currentRouteName')
    get onInstitutions() {
        return this.router.currentRouteName === 'institutions';
    }
}
