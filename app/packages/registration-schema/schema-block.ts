export type SchemaBlockType =
    'page-heading' |
    'section-heading' |
    'subsection-heading' |
    'paragraph' |
    'question-label' |
    'short-text-input' |
    'long-text-input' |
    'file-input' |
    'contributors-input' |
    'multi-select-input' |
    'single-select-input' |
    'select-input-option' |
    'select-other-option' |
    'file-metadata-input' |
    'date-input' |
    'array-input';

export interface Suggestion {
    key: string;
    template?: string;
    autofill?: {[key: string]: string};
    button?: string;
}

export interface SchemaBlock {
    id?: string;
    blockType?: SchemaBlockType;
    schemaBlockGroupKey?: string;
    registrationResponseKey?: string | null;
    displayText?: string;
    helpText?: string;
    exampleText?: string;
    required?: boolean;
    requiredIf?: object;
    messageRequiredIf?: string;
    default?: boolean;
    index?: number;
    pattern?: string;
    spaceNormalization?: boolean;
    suggestion?: Suggestion[];
    allowAdditionalOption?: boolean;
}
