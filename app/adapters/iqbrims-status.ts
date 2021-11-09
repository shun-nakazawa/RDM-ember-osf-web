import DS from 'ember-data';
import config from 'ember-get-config';
import OsfAdapter from './osf-adapter';

const {
    OSF: {
        url: host,
        webApiNamespace: namespace,
    },
} = config;

export default class IQBRIMSStatusAdapter extends OsfAdapter {
    host = host.replace(/\/+$/, '');
    namespace = namespace;

    buildURL(
        _?: string | number,
        id?: string | null,
        __?: DS.Snapshot | null,
        ___?: string,
        ____?: {},
    ): string {
        const nodeUrl = super.buildURL('node', null, null, 'findRecord', {});
        const url = nodeUrl.replace(/\/nodes\/$/, '/project/');
        return `${url}${id}/iqbrims/status`;
    }
}

declare module 'ember-data/types/registries/adapter' {
    export default interface AdapterRegistry {
        'iqbrims-status': IQBRIMSStatusAdapter;
    } // eslint-disable-line semi
}
