import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';

import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Changeset from 'ember-changeset';
import lookupValidator from 'ember-changeset-validations';
import { ChangesetDef } from 'ember-changeset/types';
import { layout } from 'ember-osf-web/decorators/component';
import NodeModel from 'ember-osf-web/models/node';
import {
    buildValidation,
    RegistrationResponse,
    SchemaBlock,
    SchemaBlockGroup,
} from 'ember-osf-web/packages/registration-schema';
import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class ArrayInput extends Component {
    // Required param
    changeset!: ChangesetDef;
    registrationResponses!: RegistrationResponse;
    schemaBlock!: SchemaBlock;

    @alias('schemaBlock.registrationResponseKey')
    valuePath!: string;
    schemaBlockGroup!: SchemaBlockGroup;
    node!: NodeModel;

    subChangesets: ChangesetDef[] = [];

    didReceiveAttrs() {
        const raw = this.registrationResponses[this.valuePath] as string;
        if (raw) {
            const prefix = `${this.valuePath}|`;
            const values = JSON.parse(raw);
            const subChangesets: ChangesetDef[] = values.map((row: Array<{key: string, value: any}>) => {
                const subChangeset = this.createSubChangeset();
                Object.entries(row).forEach(([k, v]) => {
                    const key2 = `${prefix}${k}`;
                    subChangeset.set(key2, v);
                });
                return subChangeset;
            });
            this.set('subChangesets', subChangesets);
        } else {
            this.set('subChangesets', []);
        }
    }

    @computed('subChangesets')
    get subs() {
        return this.get('subChangesets').map(subChangeset => {
            const changes: Array<{key: string, value: any}> = subChangeset.changes as any;
            const subRegistrationResponse: {[key: string]: any} = {};
            changes.forEach(({ key, value }) => {
                subRegistrationResponse[key] = value;
            });
            return { subChangeset, subRegistrationResponse };
        });
    }

    createSubChangeset() {
        const validations = buildValidation(this.schemaBlockGroup.children!, this.node);
        const subChangeset = new Changeset(
            {},
            lookupValidator(validations),
            validations,
        ) as ChangesetDef;
        return subChangeset;
    }
}
