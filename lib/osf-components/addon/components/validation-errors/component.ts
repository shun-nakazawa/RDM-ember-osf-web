import { assert } from '@ember/debug';
import { inject as service } from '@ember/service';
import { isEmpty } from '@ember/utils';
import Component from '@glimmer/component';
import { RawValidationResult } from 'ember-changeset-validations/utils/validation-errors';
import { ChangesetDef } from 'ember-changeset/types';
import Intl from 'ember-intl/services/intl';

interface Args {
    changeset?: ChangesetDef;
    key?: string;
    errors?: string | string[];
}

export default class ValidationErrors extends Component<Args> {
    @service intl!: Intl;

    constructor(owner: unknown, args: Args) {
        super(owner, args);
        const { changeset, key, errors } = args;

        assert('validation-errors - requires (@changeset and @key!) or @errors',
            Boolean(changeset && key) || !isEmpty(errors));
    }

    get errors() {
        // TODO: remove when we get rid of ember-cp-validations.
        const { errors } = this.args;
        if (errors) {
            if (Array.isArray(errors) && errors.every(error => typeof error === 'string')) {
                // default validator messages from ember-cp-validations
                return errors;
            }
            if (typeof errors === 'string') {
                // custom validators that use createErrorMessage...
                // (and extend ember-cp-validations/validators/base) return a translated string.
                return [errors];
            }
        }
        return [];
    }

    get validatorResults() {
        const { changeset, key } = this.args;
        if (changeset && key) {
            const errors = changeset.get('error')[key];
            const validatorErrors: RawValidationResult[] = errors ? errors.validation : [];

            if (Array.isArray(validatorErrors)) {
                return validatorErrors.map(
                    ({ context: { type, translationArgs } }) => {
                        const localizedArgs: Array<[string, (string | number)]> = Object.entries(translationArgs || {})
                            .map(([k, v]) => [k, this.getLocalizedText(v)]);
                        const localizedArgMap = localizedArgs.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
                        return this.intl.t(
                            `validationErrors.${type}`, localizedArgMap,
                        );
                    },
                );
            }
        }
        return [];
    }

    get validatorErrors() {
        const { errors, validatorResults } = this;
        return isEmpty(errors) ? validatorResults : errors;
    }

    getLocalizedText(text: string | number): string | number {
        if (typeof text !== 'string') {
            return text;
        }
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
