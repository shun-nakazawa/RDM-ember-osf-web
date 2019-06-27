import { attr } from '@ember-decorators/data';
import OsfModel from './osf-model';

export default class IQBRIMSStatusModel extends OsfModel {
    @attr('boolean') isAdmin!: boolean;
    @attr('string') taskUrl?: string;
    @attr('string') state!: string;
    @attr('string') laboId?: string;
    @attr('string') contributorType?: string;
    @attr('string') acceptedDate?: string;
    @attr('string') journalName?: string;
    @attr('string') doi?: string;
    @attr('string') publishDate?: string;
    @attr('string') volume?: string;
    @attr('string') pageNumber?: string;
    @attr('fixstringarray') laboList?: string[];
    @attr('boolean') isDirectlySubmitData!: boolean;
    @attr('string') workflowOverallState?: string;
    @attr('string') workflowPaperState?: string;
    @attr('string') workflowRawState?: string;
    @attr('string') workflowChecklistState?: string;
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'iqbrims-status': IQBRIMSStatusModel;
    } // eslint-disable-line semi
}
