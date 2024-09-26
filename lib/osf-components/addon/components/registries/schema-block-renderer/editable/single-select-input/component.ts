import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { assert } from '@ember/debug';
import { action, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { ChangesetDef } from 'ember-changeset/types';
import Intl from 'ember-intl/services/intl';
import { layout } from 'ember-osf-web/decorators/component';
import { SchemaBlock } from 'ember-osf-web/packages/registration-schema';
import template from './template';

@layout(template)
@tagName('')
export default class SingleSelectInput extends Component {
    @service intl!: Intl;
    // Required param
    optionBlocks!: SchemaBlock[];
    changeset!: ChangesetDef;

    @alias('schemaBlock.registrationResponseKey')
    valuePath!: string;
    onInput!: () => void;

    @alias('schemaBlock.allowAdditionalOption')
    allowAdditionalOption!: boolean;
    anotherOption?: string;

    didReceiveAttrs() {
        assert(
            'SchemaBlockRenderer::Editable::SingleSelectInput requires optionBlocks to render',
            Boolean(this.optionBlocks),
        );
    }

    didRender() {
        if (!this.changeset.get(this.valuePath)) {
            for (const optionBlock of this.optionBlocks) {
                if (optionBlock.default) {
                    this.changeset.set(this.valuePath, optionBlock.displayText);
                }
            }
        }
    }

    @computed('optionBlocks.[]', 'anotherOption')
    get optionBlockValues() {
        const options = this.optionBlocks
            .map(item => this.getLocalizedItemText(item));
        if (this.anotherOption) {
            options.push(this.anotherOption);
        }
        return options;
    }

    @action
    onChange(option: string) {
        const code = (option.split('|').pop() || '').trim();
        const item = this.optionBlocks.find(b => code === b.displayText);
        const result = item ? item.displayText : option;
        this.changeset.set(this.valuePath, result);
        this.onInput();
        this.set('anotherOption', null);
    }

    @action
    onInputSearch(text: string) {
        if (!this.allowAdditionalOption) {
            return true;
        }
        if (!this.optionBlocks.find(item => item.displayText === text || this.getLocalizedItemText(item) === text)) {
            this.set('anotherOption', text);
        }
        return true;
    }

    getLocalizedItemText(item: SchemaBlock) {
        const text = item.helpText || item.displayText;
        if (text === undefined) {
            return item.displayText;
        }
        const label = this.getLocalizedText(text);
        return `${label} | ${item.displayText}`;
    }

    getLocalizedText(text: string) {
        if (!text.includes('|')) {
            return text;
        }
        const texts = text.split('|');
        if (this.intl.locale.includes('ja')) {
            return texts[0];
        }
        return texts[1];
    }
}
