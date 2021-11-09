import Component from '@ember/component';
import { action, computed } from '@ember/object';
import config from 'ember-get-config';

import { layout } from 'ember-osf-web/decorators/component';
import Node from 'ember-osf-web/models/node';
import NodeAddonModel from 'ember-osf-web/models/node-addon';

import styles from './styles';
import template from './template';

export type NodeLike = Pick<Node, 'id' | 'isRegistration'>;

@layout(template, styles)
export default class NodeNavbar extends Component {
    // Optional parameters
    node?: Node;
    allowComments?: boolean;
    renderInPlace?: boolean;

    // Private properties
    secondaryNavbarId = config.secondaryNavbarId;
    collapsedNav = true;

    @computed('node.isRegistration')
    get fakeParent(): NodeLike | null {
        if (this.node) {
            const id = this.node.belongsTo('parent').id();
            if (id) {
                return {
                    id,
                    // The parent of a registration is always a registration. When a component
                    // is registered without its parent, the registration is its own root.
                    isRegistration: this.node.isRegistration,
                };
            }
        }
        return null;
    }

    @computed('node.addons')
    get iqbrimsEnabled(): boolean | null {
        if (!this.node) {
            return null;
        }
        let result = null;
        this.getAddons()
            .then(addons => {
                result = addons
                    .filter(addon => addon.id === 'iqbrims' && addon.configured)
                    .length > 0;
                this.set('iqbrimsEnabled', result);
            });
        return result;
    }

    @computed('node.addons')
    get binderhubEnabled(): boolean | null {
        if (!this.node) {
            return null;
        }
        let result = null;
        this.getAddons()
            .then(addons => {
                result = addons
                    .filter(addon => addon.id === 'binderhub' && addon.configured)
                    .length > 0;
                this.set('binderhubEnabled', result);
            });
        return result;
    }

    @action
    toggleNav() {
        this.toggleProperty('collapsedNav');
    }

    async getAddons(): Promise<NodeAddonModel[]> {
        const { node } = this;
        if (!node) {
            return [];
        }
        const addons = await node.addons;
        if (!addons) {
            return [];
        }
        return addons.map(addon => addon);
    }
}
