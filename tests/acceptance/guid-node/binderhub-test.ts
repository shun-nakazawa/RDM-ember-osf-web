// TODO: 一旦保留
// import { currentRouteName } from '@ember/test-helpers';
// import { setupMirage } from 'ember-cli-mirage/test-support';
// import { percySnapshot } from 'ember-percy';
// import { module, test } from 'qunit';
// import sinon from 'sinon';
//
// import BinderHubConfigModel from 'ember-osf-web/models/binderhub-config';
// import FileModel from 'ember-osf-web/models/file';
// import { Permission } from 'ember-osf-web/models/osf-model';
// import { currentURL, setupOSFApplicationTest, visit } from 'ember-osf-web/tests/helpers';
//
// module('Acceptance | guid-node/binderhub', hooks => {
//     setupOSFApplicationTest(hooks);
//     setupMirage(hooks);
//
//     test('logged in', async assert => {
//         const node = server.create('node', {
//             id: 'i9bri',
//             currentUserPermissions: [Permission.Write],
//         });
//         server.create('binderhub-config', {
//             id: node.id,
//             binderhub: {
//                 url: 'http://localhost:8585/',
//                 authorize_url: 'http://localhost/authorize',
//                 token: {
//                     access_token: 'TESTBHTOKEN',
//                     token_type: 'Bearer',
//                     expires_at: null,
//                 },
//             },
//             jupyterhub: {
//                 url: 'http://localhost:30123/',
//                 api_url: 'http://localhost:30123/hub/api/',
//                 authorize_url: 'http://localhost/authorize',
//                 token: {
//                     user: 'testuser',
//                     access_token: 'TESTJHTOKEN',
//                     token_type: 'Bearer',
//                     expires_at: null,
//                 },
//             },
//             deployment: {
//                 images: [
//                     {
//                         url: 'jupyter/test-image',
//                         name: 'Test Image',
//                         description: 'dummy description',
//                         packages: ['conda'],
//                     },
//                 ],
//             },
//             launcher: {
//                 endpoints: [
//                     {
//                         id: 'fake',
//                         name: 'Fake',
//                         path: 'Fake',
//                     },
//                 ],
//             },
//         });
//         const osfstorage = server.create('file-provider',
//             { node, name: 'osfstorage' });
//         const fileOne = server.create('file',
//             { target: node, name: 'a', dateModified: new Date(2019, 3, 3) });
//         const fileTwo = server.create('file',
//             { target: node, name: 'b', dateModified: new Date(2019, 2, 2) });
//         osfstorage.rootFolder.update({
//             files: [fileOne, fileTwo],
//         });
//         const sandbox = sinon.createSandbox();
//         const ajaxStub = sandbox.stub(BinderHubConfigModel.prototype, 'jupyterhubAPIAJAX');
//         ajaxStub.resolves({
//             kind: 'user',
//             name: 'testuser',
//             servers: {},
//         });
//         const url = `/${node.id}/binderhub`;
//
//         await visit(url);
//         assert.equal(currentURL(), url, `We are on ${url}`);
//         assert.equal(currentRouteName(), 'guid-node.binderhub', 'We are at guid-node.binderhub');
//         await percySnapshot(assert);
//         assert.dom('[data-test-servers-header]').exists();
//         assert.dom('[data-test-binderhub-header]').exists();
//         assert.dom('[data-test-launch]').exists();
//         assert.dom('[data-test-image-selection="jupyter/test-image"]').exists();
//         assert.dom('[data-test-image-selected]').doesNotExist();
//         assert.dom('[data-test-package-editor="apt"]').doesNotExist();
//         assert.dom('[data-test-package-editor="conda"]').doesNotExist();
//         assert.dom('[data-test-package-editor="pip"]').doesNotExist();
//
//         assert.ok(
//             ajaxStub.calledOnceWithExactly('users/testuser', null),
//             'BinderHub calls JupyterHub REST API',
//         );
//
//         sandbox.restore();
//     });
//
//     test('already configured, Dockerfile', async assert => {
//         const node = server.create('node', {
//             id: 'i9bri',
//             currentUserPermissions: [Permission.Write],
//         });
//         server.create('binderhub-config', {
//             id: node.id,
//             binderhub: {
//                 url: 'http://localhost:8585/',
//                 authorize_url: 'http://localhost/authorize',
//                 token: {
//                     access_token: 'TESTBHTOKEN',
//                     token_type: 'Bearer',
//                     expires_at: null,
//                 },
//             },
//             jupyterhub: {
//                 url: 'http://localhost:30123/',
//                 api_url: 'http://localhost:30123/hub/api/',
//                 authorize_url: 'http://localhost/authorize',
//                 token: {
//                     user: 'testuser',
//                     access_token: 'TESTJHTOKEN',
//                     token_type: 'Bearer',
//                     expires_at: null,
//                 },
//             },
//             deployment: {
//                 images: [
//                     {
//                         url: 'jupyter/scipy-notebook',
//                         name: 'Test Image',
//                         description: 'dummy description',
//                         packages: ['conda'],
//                     },
//                 ],
//             },
//             launcher: {
//                 endpoints: [
//                     {
//                         id: 'fake',
//                         name: 'Fake',
//                         path: 'Fake',
//                     },
//                 ],
//             },
//         });
//         const osfstorage = server.create('file-provider',
//             { node, name: 'osfstorage' });
//         const fileOne = server.create('file',
//             { target: node, name: 'a', dateModified: new Date(2019, 3, 3) });
//         const dockerfile = server.create('file',
//             { target: node, name: 'Dockerfile', dateModified: new Date(2019, 2, 2) });
//         osfstorage.rootFolder.update({
//             files: [fileOne, dockerfile],
//         });
//         const sandbox = sinon.createSandbox();
//         const ajaxStub = sandbox.stub(BinderHubConfigModel.prototype, 'jupyterhubAPIAJAX');
//         ajaxStub.resolves({
//             kind: 'user',
//             name: 'testuser',
//             servers: {},
//         });
//         const getContentsStub = sandbox.stub(FileModel.prototype, 'getContents');
//         const toStringStub = sinon.stub();
//         toStringStub.returns('# rdm-binderhub:hash:7c5b3a3d0a63ffd19147fd8c5e52d9a0\nFROM jupyter/scipy-notebook\n');
//         getContentsStub.resolves({ toString: toStringStub });
//         const url = `/${node.id}/binderhub`;
//
//         await visit(url);
//         assert.equal(currentURL(), url, `We are on ${url}`);
//         assert.equal(currentRouteName(), 'guid-node.binderhub', 'We are at guid-node.binderhub');
//         await percySnapshot(assert);
//         assert.dom('[data-test-servers-header]').exists();
//         assert.dom('[data-test-binderhub-header]').exists();
//         assert.dom('[data-test-launch]').exists();
//         assert.dom('[data-test-image-change="jupyter/scipy-notebook"]').exists();
//         assert.dom('[data-test-image-selected="jupyter/scipy-notebook"]').exists();
//         assert.dom('[data-test-image-selection]').doesNotExist();
//         assert.dom('[data-test-package-editor="apt"]').exists();
//         assert.dom('[data-test-package-editor="conda"]').exists();
//         assert.dom('[data-test-package-editor="pip"]').doesNotExist();
//         assert.dom('[data-test-package-editor="rmran"]').doesNotExist();
//
//         assert.ok(
//             getContentsStub.calledOnceWithExactly(),
//             'BinderHub retrieves Dockerfile data',
//         );
//         assert.ok(
//             ajaxStub.calledOnceWithExactly('users/testuser', null),
//             'BinderHub calls JupyterHub REST API',
//         );
//
//         sandbox.restore();
//     });
//
//     test('already configured, repo2docker', async assert => {
//         const node = server.create('node', {
//             id: 'i9bri',
//             currentUserPermissions: [Permission.Write],
//         });
//         server.create('binderhub-config', {
//             id: node.id,
//             binderhub: {
//                 url: 'http://localhost:8585/',
//                 authorize_url: 'http://localhost/authorize',
//                 token: {
//                     access_token: 'TESTBHTOKEN',
//                     token_type: 'Bearer',
//                     expires_at: null,
//                 },
//             },
//             jupyterhub: {
//                 url: 'http://localhost:30123/',
//                 api_url: 'http://localhost:30123/hub/api/',
//                 authorize_url: 'http://localhost/authorize',
//                 token: {
//                     user: 'testuser',
//                     access_token: 'TESTJHTOKEN',
//                     token_type: 'Bearer',
//                     expires_at: null,
//                 },
//             },
//             deployment: {
//                 images: [
//                     {
//                         url: '#repo2docker#r-base',
//                         name: 'Test Repo2Docker',
//                         description: 'dummy description',
//                         packages: ['conda', 'rmran'],
//                     },
//                 ],
//             },
//             launcher: {
//                 endpoints: [
//                     {
//                         id: 'fake',
//                         name: 'Fake',
//                         path: 'Fake',
//                     },
//                 ],
//             },
//         });
//         const osfstorage = server.create('file-provider',
//             { node, name: 'osfstorage' });
//         const fileOne = server.create('file',
//             { target: node, name: 'a', dateModified: new Date(2019, 3, 3) });
//         const dockerfile = server.create('file',
//             { target: node, name: 'environment.yml', dateModified: new Date(2019, 2, 2) });
//         osfstorage.rootFolder.update({
//             files: [fileOne, dockerfile],
//         });
//         const sandbox = sinon.createSandbox();
//         const ajaxStub = sandbox.stub(BinderHubConfigModel.prototype, 'jupyterhubAPIAJAX');
//         ajaxStub.resolves({
//             kind: 'user',
//             name: 'testuser',
//             servers: {},
//         });
//         const getContentsStub = sandbox.stub(FileModel.prototype, 'getContents');
//         const toStringStub = sinon.stub();
//         toStringStub.returns('# rdm-binderhub:hash:bb2a9dd68272d5f92e93acfbcfbbd267\n'
//             + 'name: "#repo2docker#r-base"\ndependencies:\n- r-base\n');
//         getContentsStub.resolves({ toString: toStringStub });
//         const url = `/${node.id}/binderhub`;
//
//         await visit(url);
//         assert.equal(currentURL(), url, `We are on ${url}`);
//         assert.equal(currentRouteName(), 'guid-node.binderhub', 'We are at guid-node.binderhub');
//         await percySnapshot(assert);
//         assert.dom('[data-test-servers-header]').exists();
//         assert.dom('[data-test-binderhub-header]').exists();
//         assert.dom('[data-test-launch]').exists();
//         assert.dom('[data-test-image-change="#repo2docker#r-base"]').exists();
//         assert.dom('[data-test-image-selected="#repo2docker#r-base"]').exists();
//         assert.dom('[data-test-image-selection]').doesNotExist();
//         assert.dom('[data-test-package-editor="apt"]').exists();
//         assert.dom('[data-test-package-editor="conda"]').exists();
//         assert.dom('[data-test-package-editor="pip"]').doesNotExist();
//         assert.dom('[data-test-package-editor="rmran"]').exists();
//
//         assert.ok(
//             getContentsStub.calledOnceWithExactly(),
//             'BinderHub retrieves Dockerfile data',
//         );
//         assert.ok(
//             ajaxStub.calledOnceWithExactly('users/testuser', null),
//             'BinderHub calls JupyterHub REST API',
//         );
//
//         sandbox.restore();
//     });
// });
