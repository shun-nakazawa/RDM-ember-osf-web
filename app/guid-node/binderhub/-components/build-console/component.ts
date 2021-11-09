import Component from '@ember/component';
import EmberError from '@ember/error';
import { action, computed } from '@ember/object';
import { htmlSafe } from '@ember/template';
import DS from 'ember-data';
import { requiredAction } from 'ember-osf-web/decorators/component';
import AnsiUp from 'ember-osf-web/guid-node/binderhub/-components/build-console/ansi_up';
import { getJupyterHubServerURL } from 'ember-osf-web/guid-node/binderhub/-components/jupyter-servers-list/component';
import { BootstrapPath, BuildMessage } from 'ember-osf-web/guid-node/binderhub/controller';
import BinderHubConfigModel from 'ember-osf-web/models/binderhub-config';
import $ from 'jquery';

export default class BuildConsole extends Component {
    binderHubConfig!: DS.PromiseObject<BinderHubConfigModel> & BinderHubConfigModel;

    buildLog!: BuildMessage[] | null;

    buildLogLineCount = 0;

    buildStatusOpen = true;

    buildPhase!: string | null;

    @requiredAction requestBuild!: (path: BootstrapPath | null, callback: (result: BuildMessage) => void) => void;

    didReceiveAttrs() {
        if (!this.buildLog) {
            return;
        }
        if (this.buildLog.length === this.buildLogLineCount) {
            return;
        }
        this.buildLogLineCount = this.buildLog.length;
        this.scrollToBottom();
    }

    @computed('buildLog')
    get buildLogLines(): string {
        if (!this.buildLog) {
            return '';
        }
        return this.buildLog.map(log => log.message).join('');
    }

    @computed('buildLog')
    get buildLogLinesHTML() {
        if (!this.buildLog) {
            return htmlSafe('');
        }
        const text = this.buildLog.map(log => log.message).join('');
        const ansiUp = new AnsiUp();
        return htmlSafe(ansiUp.ansi_to_html(text));
    }

    @computed('buildLog')
    get buildLogVisible(): boolean {
        if (!this.buildLog) {
            return false;
        }
        return true;
    }

    @action
    launch(this: BuildConsole, path: BootstrapPath | null) {
        this.performBuild(path);
    }

    performBuild(path: BootstrapPath | null) {
        if (!this.requestBuild) {
            return;
        }
        this.requestBuild(path, (result: BuildMessage) => {
            if (result.phase !== 'ready') {
                return;
            }
            this.performLaunch(result.url, result.token, path);
        });
    }

    performLaunch(originalUrl: string | undefined, token: string | undefined, targetPath: BootstrapPath | null) {
        if (!originalUrl || !token) {
            throw new EmberError('Missing parameters in the result');
        }
        const url = getJupyterHubServerURL(originalUrl, token, targetPath);
        window.open(url, '_blank');
    }

    scrollToBottom() {
        const terminal = $('#binderhub-build-terminal');
        const terminalContent = $('#binderhub-build-terminal pre');
        const height = terminalContent.height();
        if (!height) {
            return;
        }
        terminal.scrollTop(height);
    }
}
