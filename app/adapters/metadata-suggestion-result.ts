import DS from 'ember-data';
import config from 'ember-get-config';
import OsfAdapter from './osf-adapter';

const {
    OSF: {
        url: host,
        webApiNamespace: namespace,
    },
} = config;

export default class MetadataSuggestionResultAdapter extends OsfAdapter {
    host = host.replace(/\/+$/, '');
    namespace = namespace;

    buildURL(
        _?: string | number,
        id?: string | null,
        __?: DS.Snapshot | null,
        ___?: string,
        query?: {
            nodeId?: string,
            keyword?: string,
        },
    ): string {
        const nodeId = id || (query && query.nodeId);
        const nodeUrl = super.buildURL('node', null, null, 'query', query);
        const url = nodeUrl.replace(/\/nodes\/$/, '/project/');
        return `${url}${nodeId}/metadata/suggestions`;
    }
}

declare module 'ember-data/types/registries/adapter' {
    export default interface AdapterRegistry {
        'metadata-suggestion-result': MetadataSuggestionResultAdapter;
    } // eslint-disable-line semi
}
