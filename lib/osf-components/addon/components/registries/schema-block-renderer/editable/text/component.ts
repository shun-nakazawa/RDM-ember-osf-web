import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';

import { action, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { ChangesetDef } from 'ember-changeset/types';
import { timeout } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { DS } from 'ember-data';
import { layout } from 'ember-osf-web/decorators/component';
import MetadataSuggestionResult from 'ember-osf-web/models/metadata-suggestion-result';
import NodeModel from 'ember-osf-web/models/node';
import { SchemaBlock, Suggestion } from 'ember-osf-web/packages/registration-schema/schema-block';
import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class Text extends Component {
    // Required param
    changeset!: ChangesetDef;
    metadataChangeset!: ChangesetDef;
    schemaBlock!: SchemaBlock;
    node!: NodeModel;

    @alias('schemaBlock.registrationResponseKey')
    valuePath!: string;
    onInput!: () => void;
    onMetadataInput!: () => void;

    @alias('schemaBlock.suggestion')
    suggestions?: Suggestion[];
    suggestionResult: MetadataSuggestionResult[] = [];
    anotherSuggestionOption?: string;

    @alias('schemaBlock.spaceNormalization')
    spaceNormalization!: boolean;

    @service store!: DS.Store;

    @task({ restartable: true })
    suggestionTask = task(function *(
        this: Text,
        keyword: string,
    ) {
        if (!this.suggestions || !this.suggestions.length) {
            return;
        }
        yield timeout(500); // debounce

        const nextSuggestionResult: MetadataSuggestionResult[] = [];
        for (const suggestion of this.suggestions) {
            const suggestionResult = yield this.store.query('metadata-suggestion-result', {
                nodeId: this.node.id,
                key: suggestion.key,
                keyword,
            });
            Array.prototype.push.apply(nextSuggestionResult, suggestionResult.toArray());
        }
        this.set('suggestionResult', nextSuggestionResult);

        if (
            this.suggestionResult.every(s => s.suggestion.value[this.thisSuggestionKey] !== keyword)
            && this.anotherSuggestionOption !== keyword
        ) {
            this.set('anotherSuggestionOption', keyword);
        }
    });

    get isSuggestionForm(): boolean {
        return this.suggestions != null && this.suggestions.length > 0;
    }

    @action
    onInputWrapper() {
        const value = this.changeset.get(this.valuePath);
        this.changeValue(value);
        this.onInput();
    }

    changeValue(value: string) {
        this.changeset.set(this.valuePath, this.normalize(value));
        this.updateMetadataTitle();
    }

    updateMetadataTitle() {
        // Change metadata registration title with project-name (ja and en)
        const ja = this.changeset.get('__responseKey_project-name-ja');
        const en = this.changeset.get('__responseKey_project-name-en');
        let title;
        if (ja && en) {
            title = `${ja} (${en})`;
        } else if (ja) {
            title = ja;
        } else if (en) {
            title = en;
        }
        if (title) {
            this.metadataChangeset.set('title', title);
            this.onMetadataInput();
        }
    }

    @computed('anotherOption', 'suggestionResult')
    get suggestionOptions(): string[] {
        const options = this.suggestionResult.map(s => this.suggestionResultToText(s));
        if (this.anotherSuggestionOption) {
            options.push(this.anotherSuggestionOption);
        }
        return options;
    }

    @computed('valuePath')
    get thisSuggestionKey() {
        return this.valuePath.substring('__responseKey_'.length);
    }

    @action
    onChangeFromSuggestion(option: string) {
        if (!this.suggestions) {
            this.changeValue(option);
            this.onInput();
            return;
        }
        const optionIndex = this.suggestionOptions.indexOf(option);
        const suggestionResult = this.suggestionResult[optionIndex];
        if (!suggestionResult) {
            this.changeValue(option);
            this.onInput();
            return;
        }

        this.suggestions
            .filter(s => s.autofill)
            .forEach(s => {
                Object.entries(s.autofill!).forEach(([changesetKey, key]) => {
                    const value = suggestionResult.suggestion.value[key];
                    this.changeset.set(`__responseKey_${changesetKey}`, value);
                });
            });
        this.set('suggestionResult', []);
        this.updateMetadataTitle();
        this.onInput();
    }

    @action
    onSuggestionSearch(text: string) {
        this.suggestionTask.perform(text);
        return true;
    }

    suggestionResultToText(suggestionResult: MetadataSuggestionResult) {
        if (!this.suggestions) {
            return '';
        }
        const suggestion = this.suggestions.find(s => s.key === suggestionResult.suggestion.key);
        if (!suggestion || !suggestion.template) {
            return '';
        }
        let text = suggestion.template;
        Object.entries(suggestionResult.suggestion.value).forEach(([key, value]) => {
            text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        });
        return text;
    }

    normalize(value: string) {
        if (this.spaceNormalization) {
            return value.replace(/\s+/g, ' ').trim();
        }
        return value;
    }
}
