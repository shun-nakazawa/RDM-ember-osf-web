import DS from 'ember-data';
import OsfModel from './osf-model';

const { attr } = DS;

export default class MetadataSuggestionResultModel extends OsfModel {
    @attr('string') filepath?: string;
    @attr() suggestion!: {
        key: string,
        value: any,
    };
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'metadata-suggestion-result': MetadataSuggestionResultModel;
    } // eslint-disable-line semi
}
