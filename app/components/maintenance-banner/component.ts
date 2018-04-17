import { service } from '@ember-decorators/service';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { task } from 'ember-concurrency';
import config from 'ember-get-config';
import $ from 'jquery';
import moment from 'moment';

interface MaintenanceData {
    level?: number;
    message?: string;
    start?: string;
    end?: string;
}

export default class MaintenanceBanner extends Component.extend({
    maintenance: null,

    didReceiveAttrs(...args): void {
        this._super(...args);
        this.get('getMaintenanceStatus').perform();
    },

    getMaintenanceStatus: task(function* (): void {
        const url: string = `${config.OSF.apiUrl}/v2/status/`;
        const data = yield $.ajax(url, 'GET');
        this.set('maintenance', data.maintenance);
    }).restartable(),
}) {
    maintenance: MaintenanceData|null;
    @service analytics;

    start = computed('maintenance.start', (): string => moment(this.get('maintenance.start')).format('lll'));

    end = computed('maintenance.end', (): string => moment(this.get('maintenance.end')).format('lll'));

    utc = computed('maintenance.start', (): string => moment(this.get('maintenance.start')).format('ZZ'));

    alertType = computed('maintenance.level', function(this: MaintenanceBanner) {
        const levelMap = ['info', 'warning', 'danger'];
        return levelMap[this.get('maintenance.level') - 1];
    });
}
