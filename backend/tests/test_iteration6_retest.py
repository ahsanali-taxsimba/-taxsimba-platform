"""Iteration 6 retest — new client bootstrap + send-offer alias + Scenario A no-MTD."""
import os, uuid, pytest, requests

BASE = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE = line.split('=', 1)[1].strip()
BASE = BASE.rstrip('/')


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw})
    r.raise_for_status()
    return r.json()['access_token']


@pytest.fixture(scope="module")
def sa_headers():
    return {"Authorization": f"Bearer {_login('superadmin@taxsimba.co.uk', 'Super@123')}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login('admin@taxsimba.co.uk', 'Admin@123')}"}


@pytest.fixture(scope="module")
def fresh_admin_client(sa_headers):
    email = f"TEST_it6_admin_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{BASE}/api/users",
                      json={"email": email, "password": "Retest@123",
                            "name": "IT6 Admin Client", "role": "CLIENT"},
                      headers=sa_headers)
    assert r.status_code == 200, r.text
    uid = r.json()['id']
    tok = _login(email, "Retest@123")
    return {"email": email, "user_id": uid, "token": tok,
            "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def fresh_selfreg_client():
    email = f"TEST_it6_reg_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{BASE}/api/auth/register",
                      json={"email": email, "password": "Retest@123",
                            "name": "IT6 SelfReg Client"})
    assert r.status_code == 200, r.text
    tok = _login(email, "Retest@123")
    return {"email": email, "token": tok,
            "headers": {"Authorization": f"Bearer {tok}"}}


class TestNewClientBootstrap:
    def test_admin_created_client_has_sa_active_mtd_not_active(self, fresh_admin_client):
        ms = requests.get(f"{BASE}/api/my-services", headers=fresh_admin_client['headers']).json()
        assert ms['client_ref'].startswith('CL-')
        svcs = {s['service_type']: s for s in ms['services']}
        assert svcs['SELF_ASSESSMENT']['status'] == 'ACTIVE'
        assert svcs['SELF_ASSESSMENT']['package_code'] == 'SMART'
        assert svcs['MTD_INCOME_TAX']['status'] == 'NOT_ACTIVE'

    def test_admin_created_client_elite_upgrade_100(self, fresh_admin_client):
        up = requests.get(f"{BASE}/api/my-upgrade-options",
                          headers=fresh_admin_client['headers']).json()
        elite = [o for o in up['options'] if o['code'] == 'ELITE']
        assert elite and elite[0]['additional_amount_payable'] == 100

    def test_selfreg_client_has_sa_active_mtd_not_active(self, fresh_selfreg_client):
        ms = requests.get(f"{BASE}/api/my-services",
                          headers=fresh_selfreg_client['headers']).json()
        assert ms['client_ref'].startswith('CL-')
        svcs = {s['service_type']: s for s in ms['services']}
        assert svcs['SELF_ASSESSMENT']['status'] == 'ACTIVE'
        assert svcs['SELF_ASSESSMENT']['package_code'] == 'SMART'
        assert svcs['MTD_INCOME_TAX']['status'] == 'NOT_ACTIVE'

    def test_selfreg_client_elite_upgrade_100(self, fresh_selfreg_client):
        up = requests.get(f"{BASE}/api/my-upgrade-options",
                          headers=fresh_selfreg_client['headers']).json()
        elite = [o for o in up['options'] if o['code'] == 'ELITE']
        assert elite and elite[0]['additional_amount_payable'] == 100


class TestScenarioA_NoMTD:
    def test_no_mtd_anywhere_for_sa_only_client(self, fresh_admin_client, admin_headers):
        # Create a SA case for the fresh client
        r = requests.post(f"{BASE}/api/cases",
                          json={"client_user_id": fresh_admin_client['user_id'],
                                "service_type": "SELF_ASSESSMENT", "tax_year": "2024/25"},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        h = fresh_admin_client['headers']

        offers = requests.get(f"{BASE}/api/my-offers", headers=h).json()
        assert offers == [] or offers.get('offers', []) == []

        actions = requests.get(f"{BASE}/api/my-actions", headers=h).json()
        assert 'mtd' not in str(actions).lower()

        ms = requests.get(f"{BASE}/api/my-services", headers=h).json()
        svcs = {s['service_type']: s for s in ms['services']}
        # MTD present but as NOT_ACTIVE, SA has open case
        assert svcs['MTD_INCOME_TAX']['status'] == 'NOT_ACTIVE'
        assert svcs['SELF_ASSESSMENT']['status'] == 'ACTIVE'


class TestSendOfferAlias:
    def test_send_offer_sets_approved_and_second_call_400(self, sa_headers, admin_headers):
        # Create a fresh client + case + recommendation to test cleanly
        email = f"TEST_it6_rec_{uuid.uuid4().hex[:6]}@example.com"
        u = requests.post(f"{BASE}/api/users",
                          json={"email": email, "password": "Retest@123",
                                "name": "IT6 Rec Client", "role": "CLIENT"},
                          headers=sa_headers).json()
        case = requests.post(f"{BASE}/api/cases",
                             json={"client_user_id": u['id'],
                                   "service_type": "SELF_ASSESSMENT", "tax_year": "2024/25"},
                             headers=admin_headers).json()
        # Assign to accountant A and let accountant create a recommendation
        acc_a = requests.get(f"{BASE}/api/users?role=ACCOUNTANT", headers=sa_headers).json()
        acc_a_id = [a for a in acc_a if a['email'] == 'accountant.a@taxsimba.co.uk'][0]['id']
        requests.post(f"{BASE}/api/cases/{case['id']}/assign",
                      json={"accountant_id": acc_a_id}, headers=admin_headers)
        acc_h = {"Authorization": f"Bearer {_login('accountant.a@taxsimba.co.uk', 'Account@123')}"}
        rec = requests.post(f"{BASE}/api/cases/{case['id']}/recommend-mtd",
                            json={"reason": "Client has rental income above threshold"},
                            headers=acc_h).json()
        rid = rec['id']

        # First send-offer call
        r1 = requests.post(f"{BASE}/api/recommendations/{rid}/send-offer",
                           json={"package_code": "MTD_ESSENTIAL",
                                 "explanation": "You need MTD"},
                           headers=sa_headers)
        assert r1.status_code == 200, r1.text
        # Rec now APPROVED
        rec_after = [r for r in requests.get(f"{BASE}/api/recommendations",
                                             headers=sa_headers).json() if r['id'] == rid][0]
        assert rec_after['status'] == 'APPROVED'
        # Second call rejected 400
        r2 = requests.post(f"{BASE}/api/recommendations/{rid}/send-offer",
                           json={"package_code": "MTD_ESSENTIAL",
                                 "explanation": "second"},
                           headers=sa_headers)
        assert r2.status_code == 400
        # Exactly one offer for that recommendation
        offers = requests.get(f"{BASE}/api/offers", headers=sa_headers)
        if offers.ok:
            off_list = offers.json()
            matches = [o for o in off_list if o.get('recommendation_id') == rid]
            assert len(matches) == 1
