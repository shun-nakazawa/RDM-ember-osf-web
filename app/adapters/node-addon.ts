import DS from 'ember-data';
import OsfAdapter from './osf-adapter';

export default class NodeAddonAdapter extends OsfAdapter {
    buildURL(
        modelName?: string | number,
        id?: string | null,
        snapshot?: DS.Snapshot | null,
        requestType?: string,
    ): string {
        return super.buildURL(modelName, id, snapshot, requestType);
    }
}

declare module 'ember-data/types/registries/adapter' {
    export default interface AdapterRegistry {
        'node-addon': NodeAddonAdapter;
    } // eslint-disable-line semi
}
