import { currentRouteName } from '@ember/test-helpers';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { percySnapshot } from 'ember-percy';
import { module, test } from 'qunit';

import { currentURL, setupOSFApplicationTest, visit } from 'ember-osf-web/tests/helpers';

module('Acceptance | guid-node/iqbrims', hooks => {
    setupOSFApplicationTest(hooks);
    setupMirage(hooks);

    test('logged in, admin', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', { id: node.id, isAdmin: true });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.equal(currentURL(), url, `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').exists();
        assert.dom('[data-test-paper-title]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, not submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'initialized',
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.equal(currentURL(), url, `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').doesNotExist();
        assert.dom('[data-test-start-deposit]').exists();
        assert.dom('[data-test-start-check]').exists();
    });

    test('logged in, deposit started', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'initialized',
            edit: 'deposit',
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=overview`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').exists();
        assert.dom('[data-test-journal-name]').exists();
        assert.dom('[data-test-files-comment]').exists();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').doesNotExist();
        assert.dom('[data-test-paper-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-paper-button]').doesNotExist();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, deposit, overview submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'deposit',
            workflowPaperPermissions: ['VISIBLE', 'WRITABLE', 'UPLOADABLE'],
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=paper`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').doesNotExist();
        assert.dom('[data-test-journal-name]').exists();
        assert.dom('[data-test-files-comment]').doesNotExist();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').exists();
        assert.dom('[data-test-paper-uploader-comment]').exists();
        assert.dom('[data-test-submit-paper-button]').exists();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, deposit, paper submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'deposit',
            workflowPaperPermissions: ['VISIBLE'],
            workflowRawPermissions: ['VISIBLE', 'WRITABLE', 'UPLOADABLE'],
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=raw`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').doesNotExist();
        assert.dom('[data-test-journal-name]').exists();
        assert.dom('[data-test-files-comment]').doesNotExist();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').doesNotExist();
        assert.dom('[data-test-paper-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-paper-button]').doesNotExist();
        assert.dom('[data-test-raw-uploader]').exists();
        assert.dom('[data-test-raw-uploader-comment]').exists();
        assert.dom('[data-test-submit-raw-button]').exists();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, deposit, rawdata submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'deposit',
            workflowPaperPermissions: ['VISIBLE'],
            workflowRawPermissions: ['VISIBLE'],
            workflowChecklistPermissions: ['VISIBLE', 'WRITABLE', 'UPLOADABLE'],
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=checklist`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').doesNotExist();
        assert.dom('[data-test-journal-name]').exists();
        assert.dom('[data-test-files-comment]').doesNotExist();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').doesNotExist();
        assert.dom('[data-test-paper-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-paper-button]').doesNotExist();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').exists();
        assert.dom('[data-test-checklist-uploader-comment]').exists();
        assert.dom('[data-test-submit-checklist-button]').exists();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, deposit, checklist submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'deposit',
            workflowPaperPermissions: ['VISIBLE'],
            workflowRawPermissions: ['VISIBLE'],
            workflowChecklistPermissions: ['VISIBLE'],
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=overview`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').doesNotExist();
        assert.dom('[data-test-journal-name]').exists();
        assert.dom('[data-test-files-comment]').doesNotExist();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').doesNotExist();
        assert.dom('[data-test-paper-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-paper-button]').doesNotExist();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, check started', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'initialized',
            edit: 'check',
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=overview`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').exists();
        assert.dom('[data-test-journal-name]').doesNotExist();
        assert.dom('[data-test-files-comment]').exists();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').doesNotExist();
        assert.dom('[data-test-paper-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-paper-button]').doesNotExist();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, check, overview submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'check',
            workflowPaperPermissions: ['VISIBLE', 'WRITABLE', 'UPLOADABLE'],
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=paper`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').doesNotExist();
        assert.dom('[data-test-journal-name]').doesNotExist();
        assert.dom('[data-test-files-comment]').doesNotExist();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').exists();
        assert.dom('[data-test-paper-uploader-comment]').exists();
        assert.dom('[data-test-submit-paper-button]').exists();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });

    test('logged in, check, paper submitted', async assert => {
        const node = server.create('node', { id: 'i9bri' });
        server.create('iqbrims-status', {
            id: node.id,
            isAdmin: false,
            state: 'check',
            workflowPaperPermissions: ['VISIBLE'],
            workflowRawPermissions: ['VISIBLE', 'WRITABLE', 'UPLOADABLE'],
        });
        const url = `/${node.id}/iqbrims`;

        await visit(url);
        assert.ok(currentURL().endsWith(`${url}?tab=overview`), `We are on ${url}`);
        assert.equal(currentRouteName(), 'guid-node.iqbrims', 'We are at guid-node.iqbrims');
        await percySnapshot(assert);
        assert.dom('[data-test-task-url]').doesNotExist();
        assert.dom('[data-test-paper-title]').exists();
        assert.dom('[data-test-labo-name]').exists();
        assert.dom('[data-test-labo-selection]').doesNotExist();
        assert.dom('[data-test-journal-name]').doesNotExist();
        assert.dom('[data-test-files-comment]').doesNotExist();
        assert.dom('[data-test-submit-button]').exists();
        assert.dom('[data-test-paper-uploader]').doesNotExist();
        assert.dom('[data-test-paper-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-paper-button]').doesNotExist();
        assert.dom('[data-test-raw-uploader]').doesNotExist();
        assert.dom('[data-test-raw-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-raw-button]').doesNotExist();
        assert.dom('[data-test-checklist-uploader]').doesNotExist();
        assert.dom('[data-test-checklist-uploader-comment]').doesNotExist();
        assert.dom('[data-test-submit-checklist-button]').doesNotExist();
        assert.dom('[data-test-start-deposit]').doesNotExist();
        assert.dom('[data-test-start-check]').doesNotExist();
    });
});
