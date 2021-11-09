import ArrayProxy from '@ember/array/proxy';
import Component from '@ember/component';
import EmberError from '@ember/error';
import { action, computed } from '@ember/object';
import { later } from '@ember/runloop';
import { inject as service } from '@ember/service';
import DS from 'ember-data';
import { requiredAction } from 'ember-osf-web/decorators/component';
import BinderHubConfigModel from 'ember-osf-web/models/binderhub-config';
import FileModel from 'ember-osf-web/models/file';
import FileProviderModel from 'ember-osf-web/models/file-provider';
import Node from 'ember-osf-web/models/node';
import CurrentUser from 'ember-osf-web/services/current-user';
import getHref from 'ember-osf-web/utils/get-href';
import md5 from 'js-md5';

const REPO2DOCKER_IMAGE_ID = '#repo2docker';

enum DockerfileProperty {
    From,
    Apt,
    Conda,
    Pip,
    RMran,
    RCran,
    RGitHub,
    PostInstall,
}

function getAptPackageId(pkg: string[]) {
    return pkg[1].length > 0 ? `${pkg[0]}=${pkg[1]}` : pkg[0];
}

function parseAptPackageId(id: string) {
    const item = id.split('=');
    return item.length > 1 ? [item[0], item[1]] : [item[0], ''];
}

function getCondaPackageId(pkg: string[]) {
    return pkg[1].length > 0 ? `${pkg[0]}==${pkg[1]}` : pkg[0];
}

function parseCondaPackageId(id: string) {
    const pos = id.indexOf('==');
    if (pos < 0) {
        return [id, ''];
    }
    return [id.substring(0, pos), id.substring(pos + 2)];
}

function getPipPackageId(pkg: string[]) {
    return getCondaPackageId(pkg);
}

function parsePipPackageId(id: string) {
    return parseCondaPackageId(id);
}

function getRCranScript(packageId: string[]) {
    const name = packageId[0];
    const version = packageId[1] || '';
    const args = version.length > 0 ? `, "${version}"` : '';
    return `Rscript -e 'remotes::install_version("${name}"${args})'`;
}

function getRGitHubScript(packageId: string[]) {
    const name = packageId[0];
    const version = packageId[1] || '';
    const args = version.length > 0 ? `, ref = "${version}"` : '';
    return `Rscript -e 'remotes::install_github("${name}"${args})'`;
}

function getRMranScript(packageId: string[]) {
    const name = packageId[0];
    return `install.packages("${name}")`;
}

function removeQuotes(item: string) {
    const m = item.match(/^\s*"(.*)"\s*/);
    if (!m) {
        throw new Error(`Unexpected text: ${item}`);
    }
    return m[1];
}

interface ConfigurationFile {
    name: string;
    property: 'dockerfile' | 'environment' | 'requirements' | 'apt' | 'installR';
    modelProperty: 'dockerfileModel' | 'environmentModel' | 'requirementsModel' | 'aptModel' | 'installRModel';
}

interface ImageURL {
    fullurl: string | null;
    url: string | null;
    params: string[][] | null;
}

export default class ProjectEditor extends Component {
    @service currentUser!: CurrentUser;

    node?: Node | null = null;

    binderHubConfig!: DS.PromiseObject<BinderHubConfigModel> & BinderHubConfigModel;

    configFolder!: FileModel;

    dockerfileModel!: FileModel | null;

    environmentModel!: FileModel | null;

    requirementsModel!: FileModel | null;

    aptModel!: FileModel | null;

    installRModel!: FileModel | null;

    postInstallScriptModel!: FileModel | null;

    configStorageProvider!: FileProviderModel;

    showResetDockerfileConfirmDialog = false;

    imageSelectable = false;

    loadingPath?: string;

    refreshingPostInstallScript = false;

    dockerfile: string | undefined = undefined;

    environment: string | undefined = undefined;

    requirements: string | undefined = undefined;

    apt: string | undefined = undefined;

    installR: string | undefined = undefined;

    mranVersionSettingError = false;

    @requiredAction renewToken!: () => void;

    didReceiveAttrs() {
        if (!this.validateToken()) {
            return;
        }
        if (!this.configFolder || this.configFolder.get('path') === this.loadingPath) {
            return;
        }
        this.loadingPath = this.configFolder.get('path');
        later(async () => {
            await this.loadCurrentConfig();
            await this.performRefreshPostInstall();
        }, 0);
    }

    @computed('configFolder', 'dockerfile')
    get loading(): boolean {
        if (!this.configFolder) {
            return true;
        }
        if (this.dockerfile === undefined) {
            return true;
        }
        return false;
    }

    @computed('binderHubConfig.deployment')
    get deployment() {
        if (!this.binderHubConfig || !this.binderHubConfig.get('isFulfilled')) {
            return null;
        }
        return this.binderHubConfig.get('deployment');
    }

    @computed(
        'dockerfileManuallyChanged', 'environmentManuallyChanged',
        'requirementsManuallyChanged', 'aptManuallyChanged',
        'installRManuallyChanged',
    )
    get manuallyChanged() {
        if (this.dockerfileManuallyChanged) {
            return true;
        }
        if (this.environmentManuallyChanged) {
            return true;
        }
        if (this.requirementsManuallyChanged) {
            return true;
        }
        if (this.aptManuallyChanged) {
            return true;
        }
        if (this.installRManuallyChanged) {
            return true;
        }
        return false;
    }

    @computed('dockerfile')
    get dockerfileManuallyChanged() {
        const dockerfile = this.get('dockerfile');
        return this.verifyHashHeader(dockerfile);
    }

    @computed('environment')
    get environmentManuallyChanged() {
        const content = this.get('environment');
        return this.verifyHashHeader(content);
    }

    @computed('requirements')
    get requirementsManuallyChanged() {
        const content = this.get('requirements');
        return this.verifyHashHeader(content);
    }

    @computed('apt')
    get aptManuallyChanged() {
        const content = this.get('apt');
        return this.verifyHashHeader(content);
    }

    @computed('apt')
    get installRManuallyChanged() {
        const content = this.get('apt');
        return this.verifyHashHeader(content);
    }

    verifyHashHeader(content: string | undefined) {
        if (content === undefined) {
            return false;
        }
        const lines = content.split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
            return false;
        }
        const line = lines[0].match(/^# rdm-binderhub:hash:([a-z0-9]+)$/);
        if (!line) {
            return true;
        }
        const body = content.substring(line[0].length + 1);
        return md5(body.trim()) !== line[1];
    }

    getUpdatedDockerfile(key: DockerfileProperty, value: string) {
        // Update Dockerfile with MD5 hash
        const url = key === DockerfileProperty.From ? value : this.selectedImageUrl;
        if (this.parseImageURL(url).url === REPO2DOCKER_IMAGE_ID) {
            return '';
        }
        let content = `FROM ${url}\n\n`;
        const baseAptPackages = this.aptPackages || [];
        const aptPackages = key === DockerfileProperty.Apt
            ? value.split(/\s/).filter(item => item.length > 0)
            : baseAptPackages.map(pkg => getAptPackageId(pkg));
        const baseCondaPackages = this.condaPackages || [];
        const condaPackages = key === DockerfileProperty.Conda
            ? value.split(/\s/).filter(item => item.length > 0)
            : baseCondaPackages.map(pkg => getCondaPackageId(pkg));
        const basePipPackages = this.pipPackages || [];
        const pipPackages = key === DockerfileProperty.Pip
            ? value.split(/\s/).filter(item => item.length > 0)
            : basePipPackages.map(pkg => getPipPackageId(pkg));
        const rCranPackages = key === DockerfileProperty.RCran
            ? value.split(/\s/).filter(item => item.length > 0)
                .map(item => parseCondaPackageId(item))
            : (this.rCranPackages || []);
        const rGitHubPackages = key === DockerfileProperty.RGitHub
            ? value.split(/\s/).filter(item => item.length > 0)
                .map(item => parseCondaPackageId(item))
            : (this.rGitHubPackages || []);
        const hasPostInstall = key === DockerfileProperty.PostInstall
            ? value === 'true'
            : this.hasPostInstall;
        const superuser = aptPackages.length > 0
            || hasPostInstall
            || (condaPackages.length > 0 && this.condaSupported)
            || (pipPackages.length > 0 && this.pipSupported)
            || (rCranPackages.length > 0 && this.rCranSupported)
            || (rGitHubPackages.length > 0 && this.rGitHubSupported);
        if (superuser) {
            content += 'USER root\n';
        }
        if (aptPackages.length > 0) {
            content += 'RUN apt-get update \\\n\t&& apt-get install -y --no-install-recommends \\\n';
            content += aptPackages.map(item => `\t\t${item} \\\n`).join('');
            content += '\t&& rm -rf /var/lib/apt/lists/*\n\n';
        }
        if (condaPackages.length > 0 && this.condaSupported) {
            content += 'RUN conda install -y \\\n';
            content += condaPackages.map(item => `\t\t${item} \\\n`).join('');
            content += '\t&& conda clean -ya\n\n';
        }
        if (pipPackages.length > 0 && this.pipSupported) {
            content += 'RUN pip install -U --no-cache-dir \\\n\t\t';
            content += pipPackages.map(item => `${item} `).join(' \\\n\t\t');
            content += '\n\n';
        }
        if (rCranPackages.length > 0 && this.rCranSupported) {
            content += 'RUN ';
            content += rCranPackages.map(pid => getRCranScript(pid)).join(' \\\n\t&& ');
            content += '\n\n';
        }
        if (rGitHubPackages.length > 0 && this.rGitHubSupported) {
            content += 'RUN ';
            content += rGitHubPackages.map(pid => getRGitHubScript(pid)).join(' \\\n\t&& ');
            content += '\n\n';
        }
        if (hasPostInstall === true) {
            content += 'COPY postInstall /\n';
            content += 'RUN chmod +x /postInstall && /postInstall\n';
            content += '\n';
        }
        if (superuser) {
            content += 'USER $NB_USER\n';
        }
        content += 'COPY * ./\n';
        const checksum = md5(content.trim());
        return `# rdm-binderhub:hash:${checksum}\n${content}`;
    }

    getUpdatedEnvironment(key: DockerfileProperty, value: string) {
        // Update environment.yml with MD5 hash
        const imageURL = this.parseImageURL(
            key === DockerfileProperty.From ? value : this.selectedImageUrl,
        );
        if (imageURL.url !== REPO2DOCKER_IMAGE_ID) {
            return '';
        }
        const baseCondaPackages = this.condaPackages || [];
        let condaPackages = key === DockerfileProperty.Conda
            ? value.split(/\s/).filter(item => item.length > 0)
            : baseCondaPackages.map(pkg => getCondaPackageId(pkg));
        if (imageURL.params) {
            condaPackages = condaPackages.concat(imageURL.params.map(pkg => getCondaPackageId(pkg)));
        }
        let content = `name: "${imageURL.fullurl}"\n`;
        if (condaPackages.length > 0) {
            content += 'dependencies:\n';
            content += condaPackages.map(item => `- ${item}\n`).join('');
        }
        const checksum = md5(content.trim());
        return `# rdm-binderhub:hash:${checksum}\n${content}`;
    }

    getUpdatedRequirements(key: DockerfileProperty, value: string) {
        // Update requirements.txt with MD5 hash
        const url = key === DockerfileProperty.From ? value : this.selectedImageUrl;
        if (this.parseImageURL(url).url !== REPO2DOCKER_IMAGE_ID) {
            return '';
        }
        const image = this.findImageByUrl(url);
        if (!image.packages || !image.packages.includes('pip')) {
            return '';
        }
        const basePipPackages = this.pipPackages || [];
        const pipPackages = key === DockerfileProperty.Pip
            ? value.split(/\s/).filter(item => item.length > 0)
            : basePipPackages.map(pkg => getPipPackageId(pkg));
        if (pipPackages.length === 0 || !this.pipSupported) {
            return '';
        }
        const content = pipPackages.map(item => `${item}\n`).join('');
        const checksum = md5(content.trim());
        return `# rdm-binderhub:hash:${checksum}\n${content}`;
    }

    getUpdatedApt(key: DockerfileProperty, value: string) {
        // Update apt.txt with MD5 hash
        const url = key === DockerfileProperty.From ? value : this.selectedImageUrl;
        if (this.parseImageURL(url).url !== REPO2DOCKER_IMAGE_ID) {
            return '';
        }
        const baseAptPackages = this.aptPackages || [];
        const aptPackages = key === DockerfileProperty.Apt
            ? value.split(/\s/).filter(item => item.length > 0)
            : baseAptPackages.map(pkg => getAptPackageId(pkg));
        if (aptPackages.length === 0) {
            return '';
        }
        const content = aptPackages.map(item => `${item}\n`).join('');
        const checksum = md5(content.trim());
        return `# rdm-binderhub:hash:${checksum}\n${content}`;
    }

    getUpdatedInstallR(key: DockerfileProperty, value: string) {
        // Update install.R with MD5 hash
        const url = key === DockerfileProperty.From ? value : this.selectedImageUrl;
        if (this.parseImageURL(url).url !== REPO2DOCKER_IMAGE_ID) {
            return '';
        }
        const image = this.findImageByUrl(url);
        if (!image.packages || !image.packages.includes('rmran')) {
            return '';
        }
        const rMranPackages = key === DockerfileProperty.RMran
            ? value.split(/\s/).filter(item => item.length > 0)
                .map(item => parseCondaPackageId(item))
            : (this.rMranPackages || []);
        if (rMranPackages.length === 0) {
            return '';
        }
        const content = rMranPackages.map(item => getRMranScript(item))
            .map(item => `${item}\n`).join('');
        const checksum = md5(content.trim());
        return `# rdm-binderhub:hash:${checksum}\n${content}`;
    }

    updateFiles(key: DockerfileProperty, value: string) {
        const props: { [key: string]: string; } = {};
        props.dockerfile = this.getUpdatedDockerfile(key, value);
        props.environment = this.getUpdatedEnvironment(key, value);
        props.requirements = this.getUpdatedRequirements(key, value);
        props.apt = this.getUpdatedApt(key, value);
        props.installR = this.getUpdatedInstallR(key, value);

        later(async () => {
            await this.saveCurrentConfig(props);
        }, 0);
    }

    @computed('dockerfile', 'environment')
    get selectedImageUrl() {
        if (this.manuallyChanged) {
            return null;
        }
        const dockerfile = this.get('dockerfile');
        const environment = this.get('environment');
        if (dockerfile === undefined || environment === undefined) {
            return null;
        }
        if (environment.length > 0) {
            return this.environmentImageURL;
        }
        const fromStatements = dockerfile.split('\n')
            .filter(line => line.match(/^FROM\s+\S+\s*/));
        if (fromStatements.length === 0) {
            return null;
        }
        const fromStatement = fromStatements[0].match(/^FROM\s+(\S+)\s*/);
        if (!fromStatement) {
            return null;
        }
        return fromStatement[1];
    }

    @computed('selectedImage', 'deployment', 'imageSelectable')
    get selectableImages() {
        const deployment = this.get('deployment');
        if (!deployment) {
            return [];
        }
        const image = this.get('selectedImage');
        if (image === null) {
            return deployment.images;
        }
        if (this.get('imageSelectable')) {
            return deployment.images;
        }
        return [image];
    }

    @computed('selectedImageUrl', 'deployment')
    get selectedImage() {
        const url = this.get('selectedImageUrl');
        if (url === null) {
            return null;
        }
        return this.findImageByUrl(url);
    }

    findImageByUrl(url: string | null) {
        const deployment = this.get('deployment');
        if (!deployment) {
            throw new EmberError('Illegal config');
        }
        const images = deployment.images.filter(image => image.url === url);
        if (images.length === 0) {
            throw new EmberError(`Undefined image: ${url}`);
        }
        return images[0];
    }

    @computed('selectedImage')
    get condaSupported() {
        const image = this.get('selectedImage');
        if (image === null || !image.packages) {
            return false;
        }
        return image.packages.includes('conda');
    }

    @computed('selectedImage')
    get pipSupported() {
        const image = this.get('selectedImage');
        if (image === null || !image.packages) {
            return false;
        }
        return image.packages.includes('pip');
    }

    @computed('selectedImage')
    get rCranSupported() {
        const image = this.get('selectedImage');
        if (image === null || !image.packages) {
            return false;
        }
        return image.packages.includes('rcran');
    }

    @computed('selectedImage')
    get rGitHubSupported() {
        const image = this.get('selectedImage');
        if (image === null || !image.packages) {
            return false;
        }
        return image.packages.includes('rgithub');
    }

    @computed('selectedImage')
    get rMranSupported() {
        const image = this.get('selectedImage');
        if (image === null || !image.packages) {
            return false;
        }
        return image.packages.includes('rmran');
    }

    @computed('dockerfileStatements', 'aptLines')
    get aptPackages() {
        const aptLines = this.get('aptLines');
        if (aptLines !== null) {
            return aptLines
                .map(item => item.trim())
                .filter(item => item.length > 0)
                .map(item => parseAptPackageId(item));
        }
        const dockerfileStatements = this.get('dockerfileStatements');
        if (dockerfileStatements === null) {
            return null;
        }
        const aptGetLines = dockerfileStatements
            .filter(line => line.match(/^RUN\s+apt-get\s+update\s+.*$/));
        if (aptGetLines.length === 0) {
            return [];
        }
        const aptGetLinesMatch = aptGetLines[0]
            .match(/.+apt-get\s+install\s+-y\s+--no-install-recommends\s+(.*)&&.+/);
        if (!aptGetLinesMatch) {
            throw new EmberError(`Unexpected commands: ${aptGetLines}`);
        }
        return aptGetLinesMatch[1].split(/\s+/)
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .map(item => parseAptPackageId(item));
    }

    @computed('dockerfileStatements', 'environmentDependencies')
    get condaPackages() {
        const envDeps = this.get('environmentDependencies');
        if (envDeps !== null) {
            const imageURL = this.parseImageURL(this.get('selectedImageUrl'));
            const packages = envDeps
                .map(item => item.trim())
                .filter(item => item.length > 0)
                .map(item => parseCondaPackageId(item));
            if (!imageURL.params) {
                return packages;
            }
            const packageNames = imageURL.params.map(param => param[0]);
            return packages.filter(pkg => !packageNames.includes(pkg[0]));
        }
        const dockerfileStatements = this.get('dockerfileStatements');
        if (dockerfileStatements === null) {
            return null;
        }
        const statements = dockerfileStatements
            .map(line => line.match(/^RUN\s+conda\s+install\s+-y\s+(.*)&&.+$/))
            .map(match => (match ? match[1] : null))
            .filter(match => match !== null);
        if (statements.length === 0) {
            return [];
        }
        const statement = statements[0] as string;
        return statement.split(/\s+/)
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .map(item => parseCondaPackageId(item));
    }

    @computed('dockerfileStatements', 'requirementsLines')
    get pipPackages() {
        const reqLines = this.get('requirementsLines');
        if (reqLines !== null) {
            return reqLines
                .map(item => item.trim())
                .filter(item => item.length > 0)
                .map(item => parsePipPackageId(item));
        }
        const dockerfileStatements = this.get('dockerfileStatements');
        if (dockerfileStatements === null) {
            return null;
        }
        const statements = dockerfileStatements
            .map(line => line.match(/^RUN\s+pip\s+install\s+-U\s+--no-cache-dir\s+(.*)$/))
            .map(match => (match ? match[1] : null))
            .filter(match => match !== null);
        if (statements.length === 0) {
            return [];
        }
        const statement = statements[0] as string;
        return statement.split(/\s+/)
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .map(item => parsePipPackageId(item));
    }

    @computed('dockerfileStatements')
    get rCranPackages() {
        const dockerfileStatements = this.get('dockerfileStatements');
        if (dockerfileStatements === null) {
            return null;
        }
        const pattern = /^Rscript\s+-e\s+'remotes::install_version\(([^)]+)\)'(.*)$/;
        const statements = dockerfileStatements
            .map(line => line.trim().match(/^RUN\s+(.+)$/))
            .map(match => (match ? match[1].trim().match(pattern) : null))
            .map(match => (match ? match[0] : null))
            .filter(match => match);
        if (statements.length === 0) {
            return [];
        }
        let statement = statements[0] as string;
        const packages = [];
        while (statement.length > 0) {
            const m = statement.match(pattern);
            if (!m) {
                throw new Error(`Unexpected string: ${statement}`);
            }
            const params = m[1].split(',').map(item => removeQuotes(item));
            if (params.length === 1) {
                packages.push([params[0], '']);
            } else {
                packages.push([params[0], params[1]]);
            }
            statement = m[2].trim();
            if (statement.length === 0) {
                break;
            }
            const cont = statement.match(/^&&\s+(.+)$/);
            if (!cont) {
                throw new Error(`Unexpected string: ${statement}`);
            }
            statement = cont[1].trim();
        }
        return packages;
    }

    @computed('dockerfileStatements')
    get rGitHubPackages() {
        const dockerfileStatements = this.get('dockerfileStatements');
        if (dockerfileStatements === null) {
            return null;
        }
        const pattern = /^Rscript\s+-e\s+'remotes::install_github\(([^)]+)\)'(.*)$/;
        const statements = dockerfileStatements
            .map(line => line.trim().match(/^RUN\s+(.+)$/))
            .map(match => (match ? match[1].trim().match(pattern) : null))
            .map(match => (match ? match[0] : null))
            .filter(match => match);
        if (statements.length === 0) {
            return [];
        }
        let statement = statements[0] as string;
        const packages = [];
        while (statement.length > 0) {
            const m = statement.match(pattern);
            if (!m) {
                throw new Error(`Unexpected string: ${statement}`);
            }
            const params = m[1].split(',');
            if (params.length === 1) {
                packages.push([removeQuotes(params[0]), '']);
            } else {
                const version = params[1].trim().match(/ref\s*=\s*"(.+)"/);
                if (!version) {
                    throw new Error(`Invalid statement: ${params[1]}`);
                }
                packages.push([removeQuotes(params[0]), version[1]]);
            }
            statement = m[2].trim();
            if (statement.length === 0) {
                break;
            }
            const cont = statement.match(/^&&\s+(.+)$/);
            if (!cont) {
                throw new Error(`Unexpected string: ${statement}`);
            }
            statement = cont[1].trim();
        }
        return packages;
    }

    @computed('installRLines')
    get rMranPackages() {
        const lines = this.get('installRLines');
        if (lines === null) {
            return [];
        }
        const pattern = /^install\.packages\(([^)]+)\)\s*$/;
        const packages = lines
            .map(line => line.trim().match(pattern))
            .filter(match => match)
            .map(match => (match ? [removeQuotes(match[1]), ''] : ['', '']));
        return packages;
    }

    @computed('dockerfileStatements')
    get hasPostInstall() {
        const dockerfileStatements = this.get('dockerfileStatements');
        if (dockerfileStatements === null) {
            return null;
        }
        if (dockerfileStatements.some(
            line => line.match(/^COPY\s+postInstall.*$/) !== null,
        )) {
            return true;
        }
        return false;
    }

    @computed('dockerfile')
    get dockerfileStatements() {
        if (this.dockerfileManuallyChanged) {
            return null;
        }
        const dockerfile = this.get('dockerfile');
        if (dockerfile === undefined) {
            return null;
        }
        const lines = dockerfile.split('\n');
        let statement: string | null = null;
        const statements: string[] = [];
        for (const line of lines) {
            const m = line.match(/(.*)\\\s*$/);
            const statementPart = m ? m[1] : line.trim();
            statement = (statement || '') + statementPart;
            if (m) {
                continue;
            }
            statements.push(statement);
            statement = null;
        }
        if (statement !== null) {
            statements.push(statement);
        }
        return statements;
    }

    @computed('environment')
    get environmentDependencies() {
        if (this.environmentManuallyChanged) {
            return null;
        }
        const content = this.get('environment');
        if (content === undefined || content.length === 0) {
            return null;
        }
        const lines = content.split('\n');
        const deps: string[] = [];
        let section = '';
        for (const line of lines) {
            if (line.trim().startsWith('#')) {
                continue;
            }
            const sectionm = line.match(/\s*(\S+):\s*$/);
            if (sectionm) {
                // eslint-disable-next-line prefer-destructuring
                section = sectionm[1];
                continue;
            }
            if (section !== 'dependencies') {
                continue;
            }
            const itemm = line.match(/\s*-\s*(\S+)\s*$/);
            if (!itemm) {
                continue;
            }
            deps.push(itemm[1]);
        }
        return deps;
    }

    @computed('environment')
    get environmentImageURL() {
        if (this.environmentManuallyChanged) {
            return null;
        }
        const content = this.get('environment');
        if (content === undefined || content.length === 0) {
            return null;
        }
        const lines = content.split('\n');
        let name = null;
        for (const line of lines) {
            const m = line.match(/\s*name\s*:\s*"(\S+)"\s*$/);
            if (!m) {
                continue;
            }
            // eslint-disable-next-line prefer-destructuring
            name = m[1];
        }
        return name;
    }

    @computed('requirements')
    get requirementsLines() {
        if (this.requirementsManuallyChanged) {
            return null;
        }
        const content = this.get('requirements');
        if (content === undefined || content.length === 0) {
            return null;
        }
        return content
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0 && !item.startsWith('#'));
    }

    @computed('apt')
    get aptLines() {
        if (this.aptManuallyChanged) {
            return null;
        }
        const content = this.get('apt');
        if (content === undefined || content.length === 0) {
            return null;
        }
        return content
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0 && !item.startsWith('#'));
    }

    @computed('installR')
    get installRLines() {
        if (this.installRManuallyChanged) {
            return null;
        }
        const content = this.get('installR');
        if (content === undefined || content.length === 0) {
            return null;
        }
        return content
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0 && !item.startsWith('#'));
    }

    @computed('node')
    get nodeFilesLink() {
        if (!this.node) {
            return null;
        }
        return `${this.node.links.html}files`;
    }

    validateToken() {
        if (!this.binderHubConfig || !this.binderHubConfig.get('isFulfilled')) {
            return true;
        }
        const binderhub = this.binderHubConfig.get('binderhub');
        if (binderhub.token && (!binderhub.token.expires_at || binderhub.token.expires_at * 1000 > Date.now())) {
            return true;
        }
        if (!this.renewToken) {
            return true;
        }
        this.renewToken();
        return false;
    }

    parseImageURL(url: string | null): ImageURL {
        if (url === null) {
            return { fullurl: url, url, params: null };
        }
        const m = url.match(/^(#?[^#]+)(#.*)?$/);
        if (!m) {
            return { fullurl: url, url, params: null };
        }
        let params = null;
        if (m[2]) {
            params = m[2].substring(1).split(',')
                .map(item => item.trim().split('='))
                .map(item => (item.length === 1 ? [item[0], ''] : item));
        }
        return { fullurl: url, url: m[1], params };
    }

    get configurationFiles(): ConfigurationFile[] {
        return [
            { name: 'Dockerfile', property: 'dockerfile', modelProperty: 'dockerfileModel' },
            { name: 'environment.yml', property: 'environment', modelProperty: 'environmentModel' },
            { name: 'requirements.txt', property: 'requirements', modelProperty: 'requirementsModel' },
            { name: 'apt.txt', property: 'apt', modelProperty: 'aptModel' },
            { name: 'install.R', property: 'installR', modelProperty: 'installRModel' },
        ];
    }

    async getRootFiles(reload: boolean = false) {
        let { configFolder } = this;
        if (!configFolder) {
            return null;
        }
        if (reload) {
            configFolder = await configFolder.reload();
        }
        const files = await this.configFolder.get('files');
        if (!files) {
            return null;
        }
        return files;
    }

    async getFile(name: string, files: ArrayProxy<FileModel> | null) {
        if (files === null) {
            return null;
        }
        const envFiles = files.filter(file => file.name === name);
        if (envFiles.length === 0) {
            return null;
        }
        const envFile = await envFiles[0];
        return envFile;
    }

    async performRefreshPostInstall(reload: boolean = false) {
        if (this.hasPostInstall === null) {
            return;
        }
        if (!this.configFolder) {
            return;
        }
        let { configFolder } = this;
        if (reload) {
            configFolder = await configFolder.reload();
        }
        const files = await configFolder.get('files');
        if (!files) {
            return;
        }
        const scriptFiles = files.filter(file => file.name === 'postInstall');
        this.set('postInstallScriptModel', scriptFiles.length > 0 ? scriptFiles[0] : null);
        if (scriptFiles.length === 0 && this.hasPostInstall === false) {
            return;
        }
        if (scriptFiles.length > 0 && this.hasPostInstall === true) {
            return;
        }
        this.updateFiles(
            DockerfileProperty.PostInstall,
            scriptFiles.length > 0 ? 'true' : 'false',
        );
    }

    async loadCurrentFile(file: ConfigurationFile, files: ArrayProxy<FileModel> | null) {
        const envFile = await this.getFile(file.name, files);
        if (!envFile) {
            this.set(file.modelProperty, null);
            this.set(file.property, '');
            return;
        }
        const content = await envFile.getContents();
        this.set(file.modelProperty, envFile);
        this.set(file.property, content.toString());
    }

    async loadCurrentConfig(reload: boolean = false) {
        const files = await this.getRootFiles(reload);
        const confFiles = this.configurationFiles;
        const tasks = confFiles.map(file => this.loadCurrentFile(file, files));
        await Promise.all(tasks);
    }

    async saveCurrentFile(
        file: ConfigurationFile, files: ArrayProxy<FileModel> | null,
        props: { [key: string]: string; },
    ) {
        const content: string | undefined = props[file.property];
        if (content === undefined) {
            throw new EmberError('Illegal config');
        }
        const envFile = await this.getFile(file.name, files);
        if (content.length === 0) {
            this.set(file.modelProperty, null);
            this.set(file.property, '');
            if (!envFile) {
                return false;
            }
            await this.currentUser.authenticatedAJAX({
                url: `${getHref(envFile.links.delete)}`,
                type: 'DELETE',
                xhrFields: { withCredentials: true },
            });
            return true;
        }
        if (!envFile) {
            this.set(file.property, content);
            const links = this.configStorageProvider.get('links');
            await this.currentUser.authenticatedAJAX({
                url: `${getHref(links.upload)}?name=${file.name}`,
                type: 'PUT',
                xhrFields: { withCredentials: true },
                data: content,
            });
            return true;
        }
        this.set(file.property, content);
        await envFile.updateContents(content);
        return false;
    }

    async saveCurrentConfig(properties: { [key: string]: string; }) {
        if (!this.configFolder) {
            throw new EmberError('Illegal config');
        }
        const files = await this.getRootFiles(true);
        const confFiles = this.configurationFiles;
        const tasks = confFiles.map(file => this.saveCurrentFile(file, files, properties));
        const created = await Promise.all(tasks);
        if (!created.some(item => item)) {
            return;
        }
        await this.loadCurrentConfig(true);
    }

    async performResetDockerfile() {
        if (!this.dockerfileModel) {
            throw new EmberError('Illegal config');
        }
        const links = this.dockerfileModel.get('links');
        await this.currentUser.authenticatedAJAX({
            url: getHref(links.delete),
            type: 'DELETE',
            xhrFields: { withCredentials: true },
        });
        this.set('dockerfileModel', null);
        this.set('dockerfile', '');
        window.location.reload();
    }

    @action
    selectImage(this: ProjectEditor, url: string) {
        this.set('imageSelectable', false);
        this.updateFiles(DockerfileProperty.From, url);
    }

    @action
    aptUpdated(this: ProjectEditor, packages: Array<[string, string]>) {
        this.updateFiles(
            DockerfileProperty.Apt,
            packages.map(pkg => getAptPackageId(pkg)).join(' '),
        );
    }

    @action
    condaUpdated(this: ProjectEditor, packages: Array<[string, string]>) {
        this.updateFiles(
            DockerfileProperty.Conda,
            packages.map(pkg => getCondaPackageId(pkg)).join(' '),
        );
    }

    @action
    pipUpdated(this: ProjectEditor, packages: Array<[string, string]>) {
        this.updateFiles(
            DockerfileProperty.Pip,
            packages.map(pkg => getPipPackageId(pkg)).join(' '),
        );
    }

    @action
    rCranUpdated(this: ProjectEditor, packages: Array<[string, string]>) {
        this.updateFiles(
            DockerfileProperty.RCran,
            packages.map(pkg => getCondaPackageId(pkg)).join(' '),
        );
    }

    @action
    rGitHubUpdated(this: ProjectEditor, packages: Array<[string, string]>) {
        this.updateFiles(
            DockerfileProperty.RGitHub,
            packages.map(pkg => getCondaPackageId(pkg)).join(' '),
        );
    }

    @action
    rMranUpdated(this: ProjectEditor, packages: Array<[string, string]>) {
        if (packages.filter(pkg => pkg[1]).length > 0) {
            this.set('mranVersionSettingError', true);
            return;
        }
        this.set('mranVersionSettingError', false);
        this.updateFiles(
            DockerfileProperty.RMran,
            packages.map(pkg => getCondaPackageId(pkg)).join(' '),
        );
    }

    @action
    viewDockerfile(this: ProjectEditor) {
        if (!this.dockerfileModel) {
            throw new EmberError('Illegal config');
        }
        const fileUrl = this.dockerfileModel.get('links').html as string;
        window.open(fileUrl, '_blank');
    }

    @action
    resetDockerfile(this: ProjectEditor) {
        later(async () => {
            await this.performResetDockerfile();
        }, 0);
    }

    @action
    refreshPostInstall(this: ProjectEditor) {
        this.set('refreshingPostInstallScript', true);
        later(async () => {
            await this.performRefreshPostInstall(true);
            this.set('refreshingPostInstallScript', false);
        }, 0);
    }
}
