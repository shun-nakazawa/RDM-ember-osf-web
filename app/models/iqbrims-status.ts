import DS from 'ember-data';
import OsfModel from './osf-model';

const { attr } = DS;

export default class IQBRIMSStatusModel extends OsfModel {
    @attr('boolean') isAdmin!: boolean;
    @attr('boolean') isDirty?: boolean;
    @attr('string') taskUrl?: string;
    @attr('string') state!: string;
    @attr('string') edit?: string;
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
    @attr('string') filesComment?: string;
    @attr('boolean') hasPaper?: boolean;
    @attr('boolean') hasRaw?: boolean;
    @attr('boolean') hasChecklist?: boolean;
    @attr('string') paperComment?: string;
    @attr('string') rawComment?: string;
    @attr('string') checklistComment?: string;
    @attr('string') workflowOverallState?: string;
    @attr('string') workflowPaperState?: string;
    @attr('string') workflowRawState?: string;
    @attr('string') workflowChecklistState?: string;
    @attr('fixstringarray') workflowPaperPermissions?: string[];
    @attr('fixstringarray') workflowRawPermissions?: string[];
    @attr('fixstringarray') workflowChecklistPermissions?: string[];
    @attr('string') inputOverview?: string;
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'iqbrims-status': IQBRIMSStatusModel;
    } // eslint-disable-line semi
}
