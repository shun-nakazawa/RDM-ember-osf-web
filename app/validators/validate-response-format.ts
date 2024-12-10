import { assert } from '@ember/debug';
import { isEmpty } from '@ember/utils';
import { ValidatorFunction } from 'ember-changeset-validations';
import buildMessage from 'ember-changeset-validations/utils/validation-errors';
import File from 'ember-osf-web/models/file';
import NodeModel from 'ember-osf-web/models/node';
import { SchemaBlockGroup } from 'ember-osf-web/packages/registration-schema';
import { allSettled } from 'rsvp';
import sift from 'sift';

export function validateFileList(responseKey: string, node?: NodeModel): ValidatorFunction {
    return async (_: string, newValue: File[]) => {
        if (newValue && node) {
            const fileReloads: Array<() => Promise<File>> = [];
            newValue.forEach(file => {
                if (file && !file.isError) {
                    fileReloads.push(file.reload());
                }
            });
            await allSettled(fileReloads);

            const detachedFiles = [];

            for (const file of newValue) {
                if (file.isError || file.belongsTo('target').id() !== node.id) {
                    detachedFiles.push(file.name);
                }
            }
            const projectOrComponent = node.isRoot ? 'project' : 'component';

            if (!isEmpty(detachedFiles)) {
                const missingFilesList = detachedFiles.join(', ');
                const numOfFiles = detachedFiles.length;

                return buildMessage(responseKey, {
                    type: 'presence',
                    context: {
                        type: 'onlyProjectOrComponentFiles',
                        translationArgs: { projectOrComponent, missingFilesList, numOfFiles },
                    },
                });
            }
        }
        return true;
    };
}

export function validateRequiredIf(
    requiredIf: object,
    messageRequiredIf: string,
    _: SchemaBlockGroup[],
): ValidatorFunction {
    return async (
        __: string,
        newValue: string,
        ___: string,
        changes: Record<string, unknown>,
        content: Record<string, unknown>,
    ) => {
        assert(
            'messageRequiredIf is required when requiredIf exists',
            messageRequiredIf != null,
        );
        const otherValues = {} as {[key: string]: string};
        for (const [k, v] of Object.entries({ ...content, ...changes })) {
            const k2 = k.replace(/^__responseKey_/, '');
            if (v) {
                otherValues[k2] = v as string;
            }
        }
        const condFunc = sift(requiredIf);
        const required = condFunc(otherValues);
        if (!newValue && required) {
            return {
                type: 'presence',
                message: messageRequiredIf,
                context: {
                    type: 'no_translation',
                },
            };
        }
        return true;
    };
}
