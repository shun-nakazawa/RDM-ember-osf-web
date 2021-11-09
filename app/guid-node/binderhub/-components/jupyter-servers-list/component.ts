import Component from '@ember/component';
import EmberError from '@ember/error';
import { action, computed } from '@ember/object';
import { later } from '@ember/runloop';
import DS from 'ember-data';
import { requiredAction } from 'ember-osf-web/decorators/component';
import { BootstrapPath } from 'ember-osf-web/guid-node/binderhub/controller';
import BinderHubConfigModel from 'ember-osf-web/models/binderhub-config';
import Node from 'ember-osf-web/models/node';

/* eslint-disable camelcase */
export interface JupyterServerOptions {
    binder_persistent_request?: string;
    rdm_node?: string;
}

export interface JupyterServer {
    name: string;
    last_activity?: string | null;
    started?: string | null;
    pending?: string | null;
    ready?: boolean;
    url: string;
    user_options?: JupyterServerOptions | null;
}
/* eslint-enable camelcase */

export function getJupyterHubServerURL(
    originalUrl: string,
    token: string | undefined,
    targetPath: BootstrapPath | null,
) {
    // redirect a user to a running server with a token
    let url = originalUrl;
    if (targetPath && targetPath.path) {
        // strip trailing /
        url = url.replace(/\/$/, '');
        // trim leading '/'
        let path = targetPath.path.replace(/(^\/)/g, '');
        if (targetPath.pathType === 'file') {
            // trim trailing / on file paths
            path = path.replace(/(\/$)/g, '');
            // /tree is safe because it allows redirect to files
            // need more logic here if we support things other than notebooks
            url = `${url}/tree/${encodeURI(path)}`;
        } else {
            // pathType === 'url'
            url = `${url}/${path}`;
        }
    }
    if (!token) {
        return url;
    }
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export default class JupyterServersList extends Component {
    binderHubConfig!: DS.PromiseObject<BinderHubConfigModel> & BinderHubConfigModel;

    @requiredAction renewToken!: () => void;

    @requiredAction onError!: (exception: any) => void;

    initialized: boolean = false;

    node?: Node | null = null;

    servers: JupyterServer[] | null = null;

    showDeleteConfirmDialogTarget: JupyterServer | null = null;

    buildPhase!: string | null;

    oldBuildPhase: string | null = null;

    didReceiveAttrs() {
        if (!this.validateToken()) {
            return;
        }
        if (!this.node) {
            return;
        }
        if (this.initialized && this.buildPhase === this.oldBuildPhase) {
            return;
        }
        this.initialized = true;
        this.oldBuildPhase = this.buildPhase;
        this.performLoadServers();
    }

    @computed('servers')
    get loading(): boolean {
        if (!this.servers) {
            return true;
        }
        return false;
    }

    performLoadServers() {
        later(async () => {
            const servers = await this.loadServers();
            this.set('servers', servers);
        }, 0);
    }

    validateToken() {
        if (!this.binderHubConfig || !this.binderHubConfig.get('isFulfilled')) {
            return false;
        }
        const binderhub = this.binderHubConfig.get('binderhub');
        if (!binderhub.token || (binderhub.token.expires_at && binderhub.token.expires_at * 1000 <= Date.now())) {
            return false;
        }
        const jupyterhub = this.binderHubConfig.get('jupyterhub');
        if (jupyterhub && jupyterhub.token
            && (!jupyterhub.token.expires_at || new Date(jupyterhub.token.expires_at).getTime() > Date.now())) {
            return true;
        }
        if (!this.renewToken) {
            return false;
        }
        this.renewToken();
        return false;
    }

    async jupyterhubAPIAJAX(apiPath: string, ajaxOptions: JQuery.AjaxSettings | null = null) {
        if (!this.binderHubConfig || !this.binderHubConfig.get('isFulfilled')) {
            throw new EmberError('Illegal config');
        }
        const config = this.binderHubConfig.content as BinderHubConfigModel;
        try {
            return await config.jupyterhubAPIAJAX(apiPath, ajaxOptions);
        } catch (e) {
            if (!this.onError) {
                return null;
            }
            this.onError(e);
            return null;
        }
    }

    async loadServers(): Promise<JupyterServer[]> {
        if (!this.binderHubConfig || !this.binderHubConfig.get('isFulfilled')) {
            throw new EmberError('Illegal config');
        }
        const jupyterhub = this.binderHubConfig.get('jupyterhub');
        if (!jupyterhub || !jupyterhub.token) {
            throw new EmberError('Insufficient parameters');
        }
        const response = await this.jupyterhubAPIAJAX(`users/${jupyterhub.token.user}`);
        const result = response as any;
        if (result.servers === undefined || result.servers === null) {
            throw new EmberError('Unexpected object');
        }
        const serverNames: string[] = Object.keys(result.servers).map(key => key as string);
        serverNames.sort();
        const servers = serverNames.map(serverName => result.servers[serverName] as JupyterServer);
        return servers.filter(server => this.isTarget(server));
    }

    isTarget(server: JupyterServer) {
        if (!this.node) {
            return false;
        }
        const m = server.name.match(/^(.+)-osfstorage-(.+)$/);
        if (!m) {
            return false;
        }
        return m[1] === this.node.id;
    }

    @action
    refreshServers(this: JupyterServersList) {
        this.performLoadServers();
    }

    @action
    openServerWithPath(this: JupyterServersList, server: JupyterServer, path: BootstrapPath | null) {
        const binderHubConfig = this.get('binderHubConfig');
        const jupyterhub = binderHubConfig.get('jupyterhub');
        if (!jupyterhub) {
            throw new EmberError('Illegal config');
        }
        const url = new URL(jupyterhub.url);
        url.pathname = server.url;
        window.open(getJupyterHubServerURL(url.toString(), undefined, path), '_blank');
    }

    @action
    openServer(this: JupyterServersList, server: JupyterServer) {
        const binderHubConfig = this.get('binderHubConfig');
        const jupyterhub = binderHubConfig.get('jupyterhub');
        if (!jupyterhub) {
            throw new EmberError('Illegal config');
        }
        const url = new URL(jupyterhub.url);
        url.pathname = server.url;
        window.open(url.toString(), '_blank');
    }

    @action
    deleteServer(this: JupyterServersList) {
        if (!this.showDeleteConfirmDialogTarget || !this.binderHubConfig
            || !this.binderHubConfig.get('isFulfilled')) {
            throw new EmberError('Illegal state');
        }
        const jupyterhub = this.binderHubConfig.get('jupyterhub');
        if (!jupyterhub || !jupyterhub.token) {
            throw new EmberError('Insufficient parameters');
        }
        const { user } = jupyterhub.token;
        const server = this.showDeleteConfirmDialogTarget;
        this.set('showDeleteConfirmDialogTarget', null);
        later(async () => {
            const serverpath = server.name.length > 0 ? `servers/${server.name}` : 'server';
            await this.jupyterhubAPIAJAX(
                `users/${user}/${serverpath}`,
                {
                    method: 'DELETE',
                    contentType: 'application/json',
                    data: JSON.stringify({ remove: true }),
                },
            );
            const servers = await this.loadServers();
            this.set('servers', servers);
        }, 0);
    }
}
