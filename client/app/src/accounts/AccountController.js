(function(){

  angular
       .module('liskclient')
       .controller('AccountController', [
          'accountService', 'networkService', '$mdToast', '$mdSidenav', '$mdBottomSheet', '$timeout', '$log', '$mdDialog',
          AccountController
       ]);

  const {app} = require('electron').remote;
  /**
   * Main Controller for the Angular Material Starter App
   * @param $scope
   * @param $mdSidenav
   * @param avatarsService
   * @constructor
   */
  function AccountController( accountService, networkService, $mdToast, $mdSidenav, $mdBottomSheet, $timeout, $log, $mdDialog ) {
    var self = this;

    self.selected     = null;
    self.accounts        = [ ];
    self.selectAccount   = selectAccount;
    self.selectedVotes = [];
    self.addAccount   = addAccount;
    self.toggleList   = toggleAccountsList;
    self.makeContact  = makeContact;

    self.connectedPeer={isConnected:false};
    self.connection = networkService.getConnection();
    self.connection.then(
      function(){

      },
      function(){

      },
      function(connectedPeer){
        self.connectedPeer=connectedPeer;
        if(!self.connectedPeer.isConnected){
          $mdToast.show(
            $mdToast.simple()
              .textContent('Network disconected!')
              .hideDelay(10000)
          );
        }
      }
    );

    // Load all registered accounts
    self.accounts = accountService.loadAllAccounts();
    if(self.accounts.length>0) selectAccount(self.accounts[0]);

    // *********************************
    // Internal methods
    // *********************************

    /**
     * Hide or Show the 'left' sideNav area
     */
    function toggleAccountsList() {
      $mdSidenav('left').toggle();
    }

    self.openMenu = function($mdOpenMenu, ev) {
      originatorEv = ev;
      $mdOpenMenu(ev);
    };

    self.closeApp = function() {
      var confirm = $mdDialog.confirm()
          .title('Quit Lisk Client?')
          .ok('Quit')
          .cancel('Cancel');
      $mdDialog.show(confirm).then(function() {
        app.quit();
      });
    };

    /**
     * Select the current avatars
     * @param menuId
     */
    function selectAccount ( account ) {
      self.selected = angular.isNumber(account) ? $scope.accounts[account] : account;
      var currentaddress=self.selected.address;
      accountService
        .refreshAccount(self.selected)
        .then(function(account){
          if(self.selected.address==currentaddress){
            self.selected.balance = account.balance;
          }
        });
      accountService
        .getTransactions(currentaddress)
        .then(function(transactions){
          if(self.selected.address==currentaddress){
            if(!self.selected.transactions){
              self.selected.transactions = transactions;
            }
            else{
              transactions=transactions.sort(function(a,b){
                return b.timestamp-a.timestamp;
              });
              var temp=self.selected.transactions.sort(function(a,b){
                return b.timestamp-a.timestamp;
              });
              if(temp[0].id!=transactions[0].id){
                self.selected.transactions = transactions;
              }
            }
          }
        });
      accountService
        .getVotedDelegates(self.selected.address)
        .then(function(delegates){
          if(self.selected.address==currentaddress){
            self.selected.delegates = delegates;
            self.selectedVotes = delegates.slice(0);
          }
        });
      accountService
        .getDelegate(self.selected.publicKey)
        .then(function(delegate){
          if(self.selected.address==currentaddress){
            self.selected.delegate = delegate;
          }
        });

    }

    /**
     * Add an account
     * @param menuId
     */
    function addAccount() {
      var confirm = $mdDialog.prompt()
          .title('New Account')
          .textContent('Please enter a new address.')
          .placeholder('address')
          .ariaLabel('Address')
          .ok('Add')
          .cancel('Cancel');
      $mdDialog.show(confirm).then(function(address) {
        var isAddress = /^[0-9]+[L|l]$/g;
        if(isAddress.test(address)){
          accountService.fetchAccount(address).then(function(account){
            self.accounts.push(account);
            selectAccount(account);
            $mdToast.show(
              $mdToast.simple()
                .textContent('Account added!')
                .hideDelay(3000)
            );
          });
        }
        else{
          $mdToast.show(
            $mdToast.simple()
              .textContent('Address '+address+' is not recognised')
              .hideDelay(3000)
          );
        }

      });

    }

    /**
     * Show the Contact view in the bottom sheet
     */
    function makeContact(selectedAccount) {

        $mdBottomSheet.show({
          controllerAs  : "vm",
          templateUrl   : './src/accounts/view/contactSheet.html',
          controller    : [ '$mdBottomSheet', ContactSheetController],
          parent        : angular.element(window.document.getElementById('app'))
        }).then(function(clickedItem) {
          $log.debug( clickedItem.address + ' clicked!');
        });

        /**
         * Account ContactSheet controller
         */
        function ContactSheetController( $mdBottomSheet) {
          this.account = selectedAccount;
          this.send={fromAddress: selectedAccount.address, secondSignature:selectedAccount.secondSignature}
          this.items = [
            { name: 'Send Lisk', icon: 'send'},
            { name: 'Delete', icon: 'delete'}
          ];
          if(!selectedAccount.delegate){
            this.items.push({ name: 'Label', icon: 'local_offer'});
          }
          this.answer=function(answer){
            $mdDialog.hide(answer);
          }
          this.contactAccount = function(action) {

            $mdBottomSheet.hide(action);
            if(action.name=="Delete"){
              var confirm = $mdDialog.confirm()
                  .title('Delete Account '+ this.account.address)
                  .textContent('Are you sure? There is no way back.')
                  .ok('Delete permanently this account')
                  .cancel('Cancel');
              $mdDialog.show(confirm).then(function() {
                accountService.deleteAccount(selectedAccount).then(function(account){
                  self.accounts = accountService.loadAllAccounts();
                  if(self.accounts.length>0) selectAccount(self.accounts[0]);
                  $mdToast.show(
                    $mdToast.simple()
                      .textContent('Account deleted!')
                      .hideDelay(3000)
                  );
                });
              });
            }

            else if(action.name=="Send Lisk"){
                $mdDialog.show({
                  controllerAs       : "vm",
                  controller         : [ '$mdBottomSheet', ContactSheetController],
                  parent             : angular.element(document.getElementById('app')),
                  templateUrl        : './src/accounts/view/sendLisk.html',
                  clickOutsideToClose: true
                }).then(function(vm) {
                  if(vm){
                    accountService.sendLisk(selectedAccount.address, vm.send.toAddress, parseInt(vm.send.amount*100000000), vm.send.passphrase, vm.send.secondpassphrase).then(
                      function(transaction){
                        $mdToast.show(
                          $mdToast.simple()
                            .textContent('Transaction '+transaction.id+' sent!')
                            .hideDelay(5000)
                        );
                      },
                      function(reason) {
                        $mdToast.show(
                          $mdToast.simple()
                            .textContent('Error: '+reason)
                            .hideDelay(5000)
                        );
                      }
                    );
                  }
                });
            }

            else if (action.name=="Label") {
              var prompt = $mdDialog.prompt()
                  .title('Label')
                  .textContent('Please enter a short label.')
                  .placeholder('label')
                  .ariaLabel('Label')
                  .ok('Set')
                  .cancel('Cancel');
              $mdDialog.show(prompt).then(function(label) {
                accountService.setUsername(selectedAccount.address,label);
                self.accounts = accountService.loadAllAccounts();
                $mdToast.show(
                  $mdToast.simple()
                    .textContent('Label set')
                    .hideDelay(3000)
                );
              });
            }



          };
        }
    }

  }

})();
