import OsfSerializer from './osf-serializer';

export default class MetadataSuggestionResultSerializer extends OsfSerializer {
}

declare module 'ember-data/types/registries/serializer' {
    export default interface SerializerRegistry {
        'metadata-suggestion-result': MetadataSuggestionResultSerializer;
    } // eslint-disable-line semi
}
