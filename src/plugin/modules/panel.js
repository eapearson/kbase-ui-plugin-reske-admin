define([
    'bluebird',
    'knockout-plus',
    'numeral',
    'kb_common/html',
    'kb_common/jsonRpc/dynamicServiceClient'
], function(
    Promise,
    ko,
    numeral,
    html,
    DynamicServiceClient
) {
    var t = html.tag,
        div = t('div');

    function factory(config) {
        var runtime = config.runtime,
            hostNode, container,
            vm;

        function dateFormat(time) {
            if (time === 0) {
                return 'never';
            }
            var date = new Date(time);
            return [date.getMonth(), date.getDate(), date.getFullYear()].join('/');
        }

        // Nah, just a single-task poller.
        function Poller() {
            var running = false;
            var task;
            var timer;

            function start(theTask) {
                task = theTask;
                task.lastRun = null;
                running = true;
                if (task.runInitial) {
                    runTask()
                        .then(function() {
                            poll();
                        });
                } else {
                    poll();
                }
            }

            function stop() {
                running = false;
            }

            function runTask() {
                return task.task()
                    .catch(function(err) {
                        console.error('Error while polling', err);
                    });
            }

            function poll() {
                if (!running) {
                    return;
                }
                timer = window.setTimeout(function() {
                    runTask()
                        .finally(function() {
                            timer = null;
                            poll();
                        });
                }, task.interval);
            }

            function force() {
                if (!running) {
                    running = true;
                } else {
                    if (timer) {
                        window.clearTimeout(timer);
                        timer = null;
                    }
                }
                runTask()
                    .then(function() {
                        poll();
                    });
            }

            return {
                start: start,
                stop: stop,
                force: force
            };
        }

        function viewModel() {

            var appsStatus = ko.observableArray();


            var message = ko.observable();

            var resetStatus = ko.observable('idle');

            message('Welcome!');

            function getAppsStatus() {
                var client = new DynamicServiceClient({
                    url: runtime.config('services.service_wizard.url'),
                    module: 'KBaseKnowledgeEngine',
                    token: runtime.service('session').getAuthToken()
                });
                return client.callFunc('getAppsStatus', [])
                    .spread(function(result) {
                        return result;
                    });
            }

            function getConnectorsStatus() {
                var client = new DynamicServiceClient({
                    url: runtime.config('services.service_wizard.url'),
                    module: 'KBaseKnowledgeEngine',
                    token: runtime.service('session').getAuthToken()
                });
                return client.callFunc('getConnectorsStatus', [])
                    .spread(function(result) {
                        return result;
                    });
            }

            function doRunAppStatus(data) {
                var params = {
                    app: data.app,
                    ref_mode: 1
                };
                var client = new DynamicServiceClient({
                    url: runtime.config('services.service_wizard.url'),
                    module: 'KBaseKnowledgeEngine',
                    token: runtime.service('session').getAuthToken()
                });
                return client.callFunc('runApp', [params])
                    .spread(function(result) {
                        poller.force();
                        return result;
                    })
                    .catch(function(err) {
                        console.error('Error', err);
                    });
            }

            function doReset() {
                var client = new DynamicServiceClient({
                    url: runtime.config('services.service_wizard.url'),
                    module: 'KBaseKnowledgeEngine',
                    token: runtime.service('session').getAuthToken()
                });
                resetStatus('busy');
                return client.callFunc('testInit', [])
                    .then(function(result) {
                        poller.force();
                        return result;
                    })
                    .finally(function() {
                        resetStatus('idle');
                    });
            }

            // Kick off the apps status population.
            function updateAppStatus() {
                return getAppsStatus()
                    .then(function(newAppsStatus) {
                        appsStatus.removeAll();
                        newAppsStatus.forEach(function(appStatus) {
                            var status = {
                                app: appStatus.app,
                                name: appStatus.app_title,
                                status: appStatus.state,
                                updatedNodes: numeral(appStatus.updated_re_nodes).format('0,0'),
                                newNodes: numeral(appStatus.new_re_nodes).format('0,0'),
                                newRelations: numeral(appStatus.new_re_links).format('0,0'),
                                lastRunAt: dateFormat(appStatus.queued_epoch_ms),
                                nextRunAt: dateFormat(appStatus.scheduled_epoch_ms)

                            };
                            appsStatus.push(status);
                        });
                    });
            }

            var connectorsStatus = ko.observableArray();

            function updateConnectorStatus() {
                return getConnectorsStatus()
                    .then(function(newConnectorsStatus) {
                        connectorsStatus.removeAll();
                        newConnectorsStatus.forEach(function(status) {
                            connectorsStatus.push({
                                user: status.user,
                                name: status.connector_title,
                                status: status.state,
                                lastRunAt: dateFormat(status.queued_epoch_ms),
                                updatedNodes: numeral(status.updated_re_nodes).format('0,0'),
                                newNodes: numeral(status.new_re_nodes).format('0,0'),
                                newRelations: numeral(status.new_re_links).format('0,0')
                            });
                        });
                    });
            }

            var pollStatus = ko.observable('idle');
            var poller = Poller();
            poller.start({
                name: 'updater',
                interval: 10000,
                runInitial: true,
                task: function() {
                    message('polling...');
                    pollStatus('busy');
                    var start = new Date().getTime();
                    return Promise.all([
                            updateAppStatus(),
                            updateConnectorStatus()
                        ])
                        .then(function() {
                            var elapsed = new Date().getTime() - start;
                            console.log('poller took: ' + elapsed + 'ms');
                        })
                        .finally(function() {
                            message('');
                            pollStatus('idle');
                        });
                }
            });



            function stop() {
                poller.stop();
            }

            // Thereafter, we will poll every X seconds.

            return {
                // Main data collections
                appsStatus: appsStatus,
                connectorsStatus: connectorsStatus,

                // Actions
                doRunAppStatus: doRunAppStatus,
                doReset: doReset,

                // status
                message: message,
                pollStatus: pollStatus,
                resetStatus: resetStatus,

                stop: stop
            };
        }

        function attach(node) {
            hostNode = node;
            container = hostNode.appendChild(document.createElement('div'));
        }

        function start(params) {
            runtime.send('ui', 'setTitle', 'RESKE Admin Tool');
            container.innerHTML = div({
                class: 'container-fluid plugin-reske-admin'
            }, [
                div({
                    class: 'row'
                }, [
                    div({
                        class: 'col-md-12'
                    }, div({
                        dataBind: {
                            component: {
                                name: '"reske-admin-control-bar"',
                                params: {
                                    doReset: 'doReset',
                                    message: 'message',
                                    pollStatus: 'pollStatus',
                                    resetStatus: 'resetStatus'
                                }
                            }
                        }
                    }))
                ]),
                div({
                    class: 'row'
                }, [
                    div({
                        class: 'col-md-12'
                    }, div({
                        dataBind: {
                            component: {
                                name: '"reske-admin-apps-status"',
                                params: {
                                    appsStatus: 'appsStatus',
                                    doRunAppStatus: 'doRunAppStatus'
                                }
                            }
                        }
                    }))
                ]),
                div({
                    class: 'row'
                }, [
                    div({
                        class: 'col-md-12'
                    }, div({
                        dataBind: {
                            component: {
                                name: '"reske-admin-connectors-status"',
                                params: {
                                    connectorsStatus: 'connectorsStatus'
                                }
                            }
                        }
                    }))
                ])
            ]);
            vm = viewModel();
            ko.applyBindings(vm, container);
        }

        function stop() {
            vm.stop();
        }

        function detach() {

        }

        return {
            attach: attach,
            start: start,
            stop: stop,
            detach: detach
        };
    }

    return {
        make: function(config) {
            return factory(config);
        }
    };
});