import Component from '@ember/component';
import EmberError from '@ember/error';
import { action, computed } from '@ember/object';
import DS from 'ember-data';
import { requiredAction } from 'ember-osf-web/decorators/component';
import { BootstrapPath } from 'ember-osf-web/guid-node/binderhub/controller';
import BinderHubConfigModel from 'ember-osf-web/models/binderhub-config';

export default class LaunchButtons extends Component {
    binderHubConfig!: DS.PromiseObject<BinderHubConfigModel> & BinderHubConfigModel;

    @requiredAction onClick!: (path: BootstrapPath | null) => void;

    @computed('binderHubConfig.launcher')
    get launcher() {
        if (!this.binderHubConfig || !this.binderHubConfig.get('isFulfilled')) {
            return null;
        }
        return this.binderHubConfig.get('launcher');
    }

    @action
    launch(this: LaunchButtons, endpointId: string) {
        if (!this.onClick) {
            return;
        }
        const endpoint = this.getEndpointById(endpointId);
        if (!endpoint) {
            throw new EmberError(`Unknown endpoint: ${endpointId}`);
        }
        this.onClick(endpoint.path ? {
            path: endpoint.path,
            pathType: 'url',
        } : null);
    }

    getEndpointById(endpointId: string) {
        if (!this.launcher) {
            return null;
        }
        const endpoints = this.launcher.endpoints
            .filter(endpoint => endpoint.id === endpointId);
        if (endpoints.length === 0) {
            return null;
        }
        return endpoints[0];
    }
}
