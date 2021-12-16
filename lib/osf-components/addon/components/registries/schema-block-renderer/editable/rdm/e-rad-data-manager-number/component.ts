import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';

import {action} from '@ember/object';
import {timeout} from 'ember-concurrency';
import {task} from 'ember-concurrency-decorators';
import { layout } from 'ember-osf-web/decorators/component';
import styles from './styles';
import template from './template';
import {alias} from "@ember/object/computed";
import {ChangesetDef} from "ember-changeset/types";

interface DataManager {
    number: string;
    name: string;
}

const dataManagers: DataManager[] = [
    {number: 'V001', name: 'Yazawa Satoshi'},
    {number: 'V010', name: 'Nakazawa Shun'},
];

@layout(template, styles)
@tagName('')
export default class ERadDataManagerNumber extends Component {
    dmNumber?: string;

    @alias('schemaBlock.registrationResponseKey')
    valuePath!: string;
    onInput!: () => void;
    changeset!: ChangesetDef;

    get dmNumbers(): string[] {
        return dataManagers.map(dm => dm.number);
    }

    didReceiveAttrs() {
        this.set('dmNumber', this.changeset.get(this.valuePath) || null);
    }

    @task({ restartable: true })
    searchDmNumber = task(function *(this: ERadDataManagerNumber, dmNumber: string) {
        // this.set('dmNumber', dmNumber);
        yield timeout(500);
        const exp = new RegExp(
            dmNumber
                .split('')
                // .filter(c => c !== ' ')
                .map(c => `${c}.*`)
                .join(''),
            'i',
        );
        const res = dataManagers.map(dm => dm.number).filter(dmn => exp.test(dmn));
        // if (dmNumber.trim().length && !res.find(dmn => dmn === dmNumber)) {
        //     res.unshift(dmNumber);
        // }
        return res;
    });

    @action
    onChange(v: string) {
        // tslint:disable-next-line:no-console
        console.log(this.onInput, this);
        this.set('dmNumber', v);
        this.changeset.set(this.valuePath, v);
        this.onInput();
        this.autoFillDmName(v);
    }

    autoFillDmName(dmNum: string) {
        const dmElem: HTMLInputElement =
            document.querySelector('[data-rdm-erad-dm-name-input] input') as HTMLInputElement;
        if (dmElem === null) {
            return;
        }
        const dmName = this.findDmName(dmNum);
        dmElem.value = dmName || '';
    }

    findDmName(dmNum: string): string | null {
        const dataManager = dataManagers
            .find(dm => dm.number === dmNum);
        return dataManager ? dataManager.name : null;
    }
}
