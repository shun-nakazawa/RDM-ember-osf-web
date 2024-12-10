import DS from 'ember-data';
import { Suggestion } from 'ember-osf-web/packages/registration-schema/schema-block';

export default class MetadataSuggestionsTransform extends DS.Transform {
    deserialize(value: Suggestion[] | null): Suggestion[] {
        return value || [];
    }

    serialize(value: Suggestion[] | null): Suggestion[] {
        return value || [];
    }
}

declare module 'ember-data/types/registries/transform' {
    export default interface TransformRegistry {
        'metadata-suggestions': any;
    } // eslint-disable-line semi
}
