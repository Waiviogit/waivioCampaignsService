const {
  expect, sinon, chai, dropDatabase, faker, mailerRequests, _, currencyRequest,
  redisGetter, app, chaiHttp, User, guestRequests, blocktradesRequests, WithdrawFunds,
} = require('test/testHelper');
const { PaymentHistoryFactory, UserFactory } = require('test/factories');
const jwt = require('jsonwebtoken');
const config = require('config');

chai.use(chaiHttp);
chai.should();
process.env.CRYPTO_KEY = faker.random.string();

describe('On mailerController', async () => {
  describe('On confirmEmailRequest', async () => {
    afterEach(() => {
      sinon.restore();
    });
    describe('On pull email', async () => {
      let user, result, reqData, email;
      beforeEach(async () => {
        await dropDatabase();
        email = faker.internet.email();
        user = await UserFactory.Create({ privateEmail: email });
        sinon.stub(mailerRequests, 'send').returns(Promise.resolve({ result: true }));
        reqData = {
          type: 'pullEmail', isGuest: false, userName: user.name,
        };
        result = await chai.request(app)
          .post('/campaigns-api/mailer/confirm-email-request')
          .send(reqData)
          .set({ 'access-token': faker.random.string() });
      });
      it('should return status 200', async () => {
        expect(result).to.have.status(200);
      });
      it('should call mailerRequest with correct args', async () => {
        const [calledArgs] = mailerRequests.send.args;
        expect(calledArgs[0]).to.have.keys(['from', 'to', 'userName', 'templateId', 'templateData']);
      });
      it('should call mailerRequest once', async () => {
        expect(mailerRequests.send.calledOnce).to.be.true;
      });
      it('should return error if user not have email', async () => {
        await User.updateOne({ _id: user._id }, { privateEmail: null });
        result = await chai.request(app)
          .post('/campaigns-api/mailer/confirm-email-request')
          .send(reqData)
          .set({ 'access-token': faker.random.string() });
        expect(result).to.have.status(409);
      });
    });
    describe('On confirm email', async () => {
      let user, result, reqData, email;
      beforeEach(async () => {
        await dropDatabase();
        email = faker.internet.email();
        user = await UserFactory.Create();
        sinon.stub(mailerRequests, 'send').returns(Promise.resolve({ result: true }));
        reqData = {
          type: 'confirmEmail', isGuest: false, userName: user.name, email,
        };
        result = await chai.request(app)
          .post('/campaigns-api/mailer/confirm-email-request')
          .send(reqData)
          .set({ 'access-token': faker.random.string() });
      });
      it('result should have status 200', async () => {
        expect(result).to.have.status(200);
      });
      it('should call mailerRequest with correct args', async () => {
        const [calledArgs] = mailerRequests.send.args;
        expect(calledArgs[0]).to.have.keys(['from', 'to', 'userName', 'templateId', 'templateData']);
      });
      it('should call mailerRequest once', async () => {
        expect(mailerRequests.send.calledOnce).to.be.true;
      });
      it('should return error if user not have email', async () => {
        await User.updateOne({ _id: user._id }, { privateEmail: email });
        result = await chai.request(app)
          .post('/campaigns-api/mailer/confirm-email-request')
          .send(reqData)
          .set({ 'access-token': faker.random.string() });
        expect(result).to.have.status(409);
      });
    });
    describe('On confirm transfer', async () => {
      afterEach(async () => {
        sinon.restore();
      });
      describe('On success', async () => {
        let user, email, amount, result, data;
        beforeEach(async () => {
          await dropDatabase();
          email = faker.internet.email();
          amount = _.random(30, 50);
          user = await UserFactory.Create({ privateEmail: email });
          await PaymentHistoryFactory.Create({ type: 'user_to_guest_transfer', amount, userName: user.name });
          sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(true));
          sinon.stub(blocktradesRequests, 'validateWallet').returns(Promise.resolve({ result: { isValid: true } }));
          sinon.stub(blocktradesRequests, 'getSession').returns(Promise.resolve({ result: { token: faker.random.string() } }));
          sinon.stub(blocktradesRequests, 'getTransactions').returns(Promise.resolve({ result: [] }));
          sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ usdCurrency: 1 }));
          sinon.stub(blocktradesRequests, 'estimateOutput').returns(Promise.resolve({ result: { outputAmount: _.random(30, 50) } }));
          sinon.stub(blocktradesRequests, 'mapping').returns(Promise.resolve(
            {
              result: {
                flatTransactionFeeInInputCoinType: 0,
                inputAddress: { memo: faker.random.string(), address: faker.random.string() },
              },
            },
          ));
          sinon.stub(mailerRequests, 'send').returns(Promise.resolve({ result: true }));
          data = {
            type: 'confirmTransaction',
            email,
            userName: user.name,
            isGuest: true,
            transactionData: {
              outputCoinType: 'eth',
              inputCoinType: 'hive',
              amount,
              address: faker.random.string(),
            },
          };
          result = await chai.request(app)
            .post('/campaigns-api/mailer/confirm-email-request')
            .send(data)
            .set({ 'access-token': faker.random.string() });
        });
        it('should return status 200', async () => {
          expect(result).to.have.status(200);
        });
        it('should create record in DB', async () => {
          const withdraw = await WithdrawFunds.findOne({ account: user.name });
          expect(withdraw.status).to.be.eq('pending');
        });
        it('should create TTL for transaction', async () => {
          const withdraw = await WithdrawFunds.findOne({ account: user.name });
          const { result: TTL } = await redisGetter.getTTLData(`expire:withdrawTransaction|${withdraw._id}`);
          expect(TTL).is.exist;
        });
        it('should call mailer method with correct keys', async () => {
          const [args] = mailerRequests.send.args;
          expect(args[0]).to.have.keys(['from', 'to', 'userName', 'templateId', 'templateData']);
        });
      });
      describe('On errors', async () => {
        let data, user;
        beforeEach(async () => {
          await dropDatabase();
          user = await UserFactory.Create({ privateEmail: faker.internet.email() });
          data = {
            type: 'confirmTransaction',
            email: faker.internet.email(),
            userName: user.name,
            isGuest: true,
            transactionData: {
              outputCoinType: 'eth',
              inputCoinType: 'hive',
              amount: 10,
              address: faker.random.string(),
            },
          };
        });
        describe('On validateUser error', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(false));
            sinon.spy(mailerRequests, 'send');
            result = await chai.request(app)
              .post('/campaigns-api/mailer/confirm-email-request')
              .send(data)
              .set({ 'access-token': faker.random.string() });
          });
          it('should return status 401', async () => {
            expect(result).to.have.status(401);
          });
          it('should not create withdraw record in DB', async () => {
            const withdraw = await WithdrawFunds.findOne({ account: user.name });
            expect(withdraw).to.be.null;
          });
          it('should not call mailer method', async () => {
            expect(mailerRequests.send.notCalled).to.be.true;
          });
        });
        describe('On validateEmail error', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(true));
            sinon.spy(mailerRequests, 'send');
            result = await chai.request(app)
              .post('/campaigns-api/mailer/confirm-email-request')
              .send(data)
              .set({ 'access-token': faker.random.string() });
          });
          it('should return 403 status', async () => {
            expect(result).to.have.status(403);
          });
          it('should return correct message', async () => {
            expect(result.body.message).to.be.eq('Invalid email');
          });
          it('should create not TTL for transaction', async () => {
            const { result: TTL } = await redisGetter.getTTLData('expire:withdrawTransaction*');
            expect(TTL).is.not.exist;
          });
          it('should not create withdraw record in DB', async () => {
            const withdraw = await WithdrawFunds.findOne({ account: user.name });
            expect(withdraw).to.be.null;
          });
          it('should not call mailer method', async () => {
            expect(mailerRequests.send.notCalled).to.be.true;
          });
        });
        describe('On validateWallet error', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(true));
            sinon.stub(blocktradesRequests, 'validateWallet').returns(Promise.resolve({ result: { isValid: false } }));
            sinon.spy(mailerRequests, 'send');
            data.email = user.privateEmail;
            result = await chai.request(app)
              .post('/campaigns-api/mailer/confirm-email-request')
              .send(data)
              .set({ 'access-token': faker.random.string() });
          });
          it('should return 403 status if wallet not valid', async () => {
            expect(result).to.have.status(403);
          });
          it('should return correct message', async () => {
            expect(result.body.message).to.be.eq('Invalid wallet');
          });
          it('should create not TTL for transaction if wallet not valid', async () => {
            const { result: TTL } = await redisGetter.getTTLData('expire:withdrawTransaction*');
            expect(TTL).is.not.exist;
          });
          it('should not create withdraw record in DB if wallet not valid', async () => {
            const withdraw = await WithdrawFunds.findOne({ account: user.name });
            expect(withdraw).to.be.null;
          });
          it('should not call mailer method if wallet not valid', async () => {
            expect(mailerRequests.send.notCalled).to.be.true;
          });
        });
        describe('On validateBalance error', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(true));
            sinon.stub(blocktradesRequests, 'validateWallet').returns(Promise.resolve({ result: { isValid: true } }));
            sinon.spy(mailerRequests, 'send');
            data.email = user.privateEmail;
            result = await chai.request(app)
              .post('/campaigns-api/mailer/confirm-email-request')
              .send(data)
              .set({ 'access-token': faker.random.string() });
          });
          it('should return 403 status if not enough balance', async () => {
            expect(result).to.have.status(403);
          });
          it('should return correct message', async () => {
            expect(result.body.message).to.be.eq('Not enough balance');
          });
          it('should create not TTL for transaction if not enough balance', async () => {
            const { result: TTL } = await redisGetter.getTTLData('expire:withdrawTransaction*');
            expect(TTL).is.not.exist;
          });
          it('should not create withdraw record in DB if not enough balance', async () => {
            const withdraw = await WithdrawFunds.findOne({ account: user.name });
            expect(withdraw).to.be.null;
          });
          it('should not call mailer method if not enough balance', async () => {
            expect(mailerRequests.send.notCalled).to.be.true;
          });
        });
        describe('On session error', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(blocktradesRequests, 'validateWallet').returns(Promise.resolve({ result: { isValid: true } }));
            sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(true));
            sinon.stub(blocktradesRequests, 'getSession').returns(Promise.resolve({ error: { message: faker.random.string() } }));
            sinon.spy(mailerRequests, 'send');
            data.email = user.privateEmail;
            await PaymentHistoryFactory.Create({ type: 'user_to_guest_transfer', amount: data.transactionData.amount, userName: user.name });
            result = await chai.request(app)
              .post('/campaigns-api/mailer/confirm-email-request')
              .send(data)
              .set({ 'access-token': faker.random.string() });
          });
          it('should return 403 status if get session error', async () => {
            expect(result).to.have.status(403);
          });
          it('should not create withdraw record in DB if get session error', async () => {
            const withdraw = await WithdrawFunds.findOne({ account: user.name });
            expect(withdraw).to.be.null;
          });
          it('should not call mailer method if get session error', async () => {
            expect(mailerRequests.send.notCalled).to.be.true;
          });
        });
        describe('On transactions error', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(blocktradesRequests, 'validateWallet').returns(Promise.resolve({ result: { isValid: true } }));
            sinon.stub(blocktradesRequests, 'getTransactions').returns(Promise.resolve({ result: [{ inputFullyConfirmedTime: new Date(), inputUsdEquivalent: 1750 }] }));
            sinon.stub(guestRequests, 'validateUser').returns(Promise.resolve(true));
            sinon.stub(blocktradesRequests, 'getSession').returns(Promise.resolve({ result: { token: faker.random.string() } }));
            sinon.spy(mailerRequests, 'send');
            data.email = user.privateEmail;
            await PaymentHistoryFactory.Create({ type: 'user_to_guest_transfer', amount: data.transactionData.amount, userName: user.name });
            result = await chai.request(app)
              .post('/campaigns-api/mailer/confirm-email-request')
              .send(data)
              .set({ 'access-token': faker.random.string() });
          });
          it('should return 403 status if account reached daily limit', async () => {
            expect(result).to.have.status(403);
          });
          it('should return correct message', async () => {
            expect(result.body.message).to.be.eq('Reached global daily limit, please try tomorrow');
          });
          it('should not create withdraw record in DB if account reached daily limit', async () => {
            const withdraw = await WithdrawFunds.findOne({ account: user.name });
            expect(withdraw).to.be.null;
          });
          it('should not call mailer method if account reached daily limit', async () => {
            expect(mailerRequests.send.notCalled).to.be.true;
          });
        });
      });
    });
  });

  describe('On confirmEmailResponse', async () => {
    describe('On pull email', async () => {
      let user, email, token, result;
      beforeEach(async () => {
        await dropDatabase();
        email = faker.internet.email();
        user = await UserFactory.Create({ privateEmail: email });
        token = jwt.sign({ userName: user.name, email }, process.env.CRYPTO_KEY, { expiresIn: 1 });
        result = await chai.request(app)
          .get(`/campaigns-api/mailer/confirm-email-response?userName=${user.name}&email=${email}&id=${token}&type=unlink`);
      });
      it('should return status 200', async () => {
        expect(result).to.have.status(200);
      });
      it('should redirect with correct url', async () => {
        expect(result.redirects[0]).to.be.eq(`${config.waivioUrl}confirmation?id=unlinkEmailSuccess&userName=${user.name}`);
      });
      it('should remove email from user', async () => {
        const updatedUser = await User.findOne({ _id: user._id }).lean();
        expect(updatedUser.privateEmail).to.be.undefined;
      });
      it('should return error id if token incorrect', async () => {
        await User.updateOne({ _id: user._id }, { privateEmail: email });
        const name = faker.name.firstName()
        result = await chai.request(app)
          .get(`/campaigns-api/mailer/confirm-email-response?userName=${name}&email=${faker.internet.email()}&id=${token}&type=unlink`);
        expect(result.redirects[0]).to.be.eq(`${config.waivioUrl}confirmation?id=unlinkEmailSecretFailed&userName=${name}`);
      });
      it('should return error id if token expired', async () => {
        await User.updateOne({ _id: user._id }, { privateEmail: email });
        await new Promise((resolve) => setTimeout(resolve, 1200));
        result = await chai.request(app)
          .get(`/campaigns-api/mailer/confirm-email-response?userName=${user.name}&email=${email}&id=${token}&type=unlink`);
        expect(result.redirects[0]).to.be.eq(`${config.waivioUrl}confirmation?id=unlinkEmailSecretFailed&userName=${user.name}`);
      });
    });
  });
});
