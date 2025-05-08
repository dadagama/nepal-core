import {
    assert,
    test, describe, expect,
    beforeEach, afterEach,
    vi
} from 'vitest';
import { SubscriptionsClient } from "@al/core";

const serviceName = 'subscriptions';
const accountId = '12345';
const queryParams = { foo: 'bar' };
const serviceVersion = "v1";

describe('Subscriptions Client Test Suite:', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('when retrieving entitlements for a given account', () => {
    //  Tautological tests are empty tests
    test( 'should call get() on the AlDefaultClient instance to the entitlements endpoint', async() => {
      const stub = vi.spyOn(SubscriptionsClient['alClient'], 'get').mockResolvedValue( {} );
      await SubscriptionsClient.getRawEntitlements(accountId, queryParams);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_stack: "global:api",
        service_name: serviceName,
        version: "v1",
        ttl: 300000,
        account_id: accountId,
        path: '/entitlements',
        params: queryParams,
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when retrieving accounts for a given enitlement', () => {
    test('should call get() on the AlDefaultClient instance to the entitlements endpoint', async() => {
      const stub = vi.spyOn(SubscriptionsClient['alClient'], 'get').mockResolvedValue( {} );
      const productFamily = 'log_manager';
      await SubscriptionsClient.getAccountsByEntitlement(accountId, productFamily);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        service_stack: "global:api",
        version: "v1",
        account_id: accountId,
        path: `/entitlements/${productFamily}`,
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when creating an AWS subscription', () => {
    test('should call post() on the AlDefaultClient instance to the /subscription/aws endpoint with the subscription data', async() => {
      const stub = vi.spyOn( SubscriptionsClient['alClient'], 'post').mockResolvedValue( {} );
      const subscription = {
        product_code:'ebbgj0o0g5cwo4**********',
        aws_customer_identifier:'7vBT7cnzEYf',
        status:'subscribe-success',
      };
      await SubscriptionsClient.createAWSSubscription(accountId, subscription);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        version: serviceVersion,
        account_id: accountId,
        path: '/subscription/aws',
        data: subscription,
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when creating a full subscription', () => {
    test('should call post() on the AlDefaultClient instance to the /subscription endpoint using the supplied entitements in the subscription data sent', async() => {
      const stub = vi.spyOn( SubscriptionsClient['alClient'], 'post').mockResolvedValue( {} );
      const entitlements = [{
        product_family_code:'log_manager',
        status:'active',
      }];
      const subscriptionData = {
        entitlements,
        active: true,
        type: 'manual',
      };
      await SubscriptionsClient.createFullSubscription(accountId, entitlements);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        version: serviceVersion,
        account_id: accountId,
        path: '/subscription',
        data: subscriptionData,
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when creating a standard subscription', () => {
    test('should call post() on the AlDefaultClient instance to the standard subscription endpoint', async() => {
      const stub = vi.spyOn( SubscriptionsClient['alClient'], 'post').mockResolvedValue( {} );
      await SubscriptionsClient.createStandardSubscription(accountId);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        version: serviceVersion,
        account_id: accountId,
        path: '/subscription/sync/standard',
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when retrieving a single subscription', () => {
    test('should call get() on the AlDefaultClient instance to the subscription endpoint for the supplied subscription ID', async() => {
      const stub = vi.spyOn( SubscriptionsClient['alClient'], 'get').mockResolvedValue( {} );
      const subscriptionId = '123-ABC=-?!';
      await SubscriptionsClient.getSubscription(accountId, subscriptionId);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        version: serviceVersion,
        account_id: accountId,
        path: `/subscription/${subscriptionId}`,
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when retrieving all subscriptions', () => {
    test('should call get() on the AlDefaultClient instance to the subscriptions endpoint for the supplied subscription ID', async() => {
      const stub = vi.spyOn( SubscriptionsClient['alClient'], 'get').mockResolvedValue( {} );
      await SubscriptionsClient.getSubscriptions(accountId);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        version: serviceVersion,
        account_id: accountId,
        path: '/subscriptions',
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
  describe('when retrieving all subscriptions', () => {
    test('should call put() on the AlDefaultClient instance to the subscription/aws endpoint with the supplied subscription data', async() => {
      const stub = vi.spyOn( SubscriptionsClient['alClient'], 'put').mockResolvedValue( {} );
      const subscription = {
        product_code:'ebbgj0o0g5cwo4**********',
        status:'unsubscribe-success',
      };
      await SubscriptionsClient.updateAWSSubscription(accountId, subscription);
      expect(stub.mock.calls.length).to.equal(1);
      const payload = {
        service_name: serviceName,
        version: serviceVersion,
        account_id: accountId,
        path: '/subscription/aws',
        data: subscription,
      };
      assert.deepEqual(payload, stub.mock.calls[0][0]);
    });
  });
});
