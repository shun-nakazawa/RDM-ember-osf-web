import { currentURL, settled, visit } from '@ember/test-helpers';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import Features from 'ember-feature-flags';
import config from 'ember-get-config';
import { t } from 'ember-intl/test-support';
import { percySnapshot } from 'ember-percy';
import { module, test } from 'qunit';

import { setupOSFApplicationTest } from 'ember-osf-web/tests/helpers';

const { featureFlagNames: { ABTesting } } = config;

module('Acceptance | logged-out home page test', hooks => {
    setupOSFApplicationTest(hooks);
    setupMirage(hooks);

    test('visiting home', async assert => {
        await visit('/');

        assert.equal(currentURL(), '/', "Still at 'home'.");
        // Check navbar
        assert.dom('nav.navbar').exists();
        assert.dom('nav.navbar .sign-in').exists();

        // Check hero
        assert.dom('[data-test-hero-heading]')
            .containsText(t('osf-components.hero-banner.headingA').toString());
        assert.dom('[data-test-hero-subheading]')
            .containsText(t('osf-components.hero-banner.subheading').toString());

        // Check footer
        assert.dom('footer').exists();
        await a11yAudit();
        await percySnapshot('Acceptance | logged-out home page test | footer exists');
    });

    test('visiting home version B', async function(assert) {
        await visit('/');
        const features = this.owner.lookup('service:features') as Features;

        features.enable(ABTesting.homePageHeroTextVersionB);

        await settled();
        assert.dom('[data-test-hero-heading]')
            .containsText(t('osf-components.hero-banner.headingB').toString());

        await a11yAudit();
        await percySnapshot(assert);
    });
});
