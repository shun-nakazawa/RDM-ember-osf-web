import Service from '@ember/service';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

import { setupRenderingTest } from 'ember-qunit';
import { module, test } from 'qunit';
import sinon from 'sinon';

module('Integration | Component | cookie-banner', hooks => {
    setupRenderingTest(hooks);
    const sandbox = sinon.createSandbox();

    hooks.afterEach(() => {
        sandbox.restore();
    });

    test('it renders', async function(assert) {
        sinon.stub(this.owner.lookup('service:cookies'), 'exists').returns(false);
        this.owner.register('service:cookies',
            class CookiesStub extends Service {
                exists() {
                    return false;
                }
            });

        await render(hbs`{{cookie-banner}}`);

        assert.dom(this.element)
            .hasText('GakuNin RDM is a service provided by National Institute of Informatics (NII) with '
                + 'its user organizations’ consent, and the rules set by each user organization shall '
                + 'apply to the individual users. GakuNin RDM uses cookies to operate its services and '
                + 'improve the user experience. Users of GakuNin RDM are requested to read the information '
                + 'on our privacy policy. By clicking "I agree" button on the right or continuing to '
                + 'use this site, you agree to our use of cookies. If you do not agree, please disable '
                + 'cookies in your browser settings or discontinue using this site. Please note that '
                + 'by not using cookies, you may not be able to use some of the functions of this site. '
                + 'Please refer to the Terms of Use for the details on the agreement between the user '
                + 'organizations and NII. Accept');
    });
});
