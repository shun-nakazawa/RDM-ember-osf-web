import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import config from 'ember-get-config';
import { layout } from 'ember-osf-web/decorators/component';
import Analytics from 'ember-osf-web/services/analytics';
import Theme from 'ember-osf-web/services/theme';
import styles from './styles';
import template from './template';

const {
    OSF: {
        pageName,
    },
} = config;

@layout(template, styles)
export default class ErrorPage extends Component {
    @service analytics!: Analytics;
    @service theme!: Theme;

    label = '';
    translateKey = '';

    title: string = pageName;

    @computed('theme.{isProvider,provider}')
    get supportEmail(): string {
        const { isProvider, provider } = this.theme;

        // TODO: get default support email from config
        return isProvider && provider && provider.emailSupport ? provider.emailSupport : 'rdm_support@nii.ac.jp';
    }
}
