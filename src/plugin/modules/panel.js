define([
    'bluebird',
    'knockout-plus',
    'numeral',
    'kb_common/html',
    'kb_common/bootstrapUtils',
    'kb_common/jsonRpc/dynamicServiceClient'
], function(
    Promise,
    ko,
    numeral,
    html,
    BS,
    DynamicServiceClient
) {
    var t = html.tag,
        div = t('div'),
        span = t('span');

    function factory(config) {
        var runtime = config.runtime,
            hostNode, container,
            vm;

        var normalPollingInterval = 10000;
        var runningPollingInterval = 1000;

        function dateFormat(time) {
            if (time === 0) {
                return 'never';
            }
            var date = new Date(time);
            return [date.getMonth() + 1, date.getDate(), date.getFullYear()].join('/');
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

            function restart() {
                if (!running) {
                    running = true;
                } else {
                    if (timer) {
                        window.clearTimeout(timer);
                        timer = null;
                    }
                }
                poll();
            }

            function update(config) {
                if (config.interval) {
                    if (config.interval !== task.interval) {
                        task.interval = config.interval;
                        restart();
                    }
                }
            }

            return {
                start: start,
                stop: stop,
                force: force,
                update: update
            };
        }

        function viewModel() {

            var appsStatus = ko.observableArray();


            var message = ko.observable();

            var resetStatus = ko.observable('idle');

            message('Welcome!');

            var jobsRunning = ko.observable(false);

            jobsRunning.subscribe(function(newValue) {
                if (newValue) {
                    poller.update({
                        interval: runningPollingInterval
                    });
                } else {
                    poller.update({
                        interval: normalPollingInterval
                    });
                }
            });

            var client = new DynamicServiceClient({
                url: runtime.config('services.service_wizard.url'),
                module: 'KBaseKnowledgeEngine',
                token: runtime.service('session').getAuthToken()
            });

            function getAppsStatus() {
                return client.callFunc('getAppsStatus', [])
                    .spread(function(result) {
                        return result;
                    });
            }

            function getConnectorsStatus() {
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

            function icon(type, color) {
                return span({
                    class: 'fa fa-' + type,
                    style: {
                        color: color || 'black'
                    }
                });
            }

            function buildStateIcon(state) {
                switch (state) {
                    case 'none':
                        return icon('ban', 'silver');

                    case 'queued':
                        return span({
                            class: 'fa fa-spinner fa-spin fa-fw',
                            style: {
                                color: 'orange'
                            }
                        });
                    case 'started':
                        return span({
                            class: 'fa fa-spinner fa-spin fa-fw',
                            style: {
                                color: 'blue'
                            }
                        });
                    case 'finished':
                        return icon('check', 'green');
                }
            }

            function buildLastRunAt(appStatus) {
                switch (appStatus.state) {
                    case 'none':
                        return span({
                            style: {
                                color: 'silver'
                            }
                        }, 'never');
                    case 'queued':
                        return span({
                            style: {
                                color: 'silver'
                            }
                        }, dateFormat(appStatus.queued_epoch_ms));
                    case 'started':
                        return span({
                            style: {
                                color: 'gray'
                            }
                        }, dateFormat(appStatus.started_epoch_ms));
                    case 'finished':
                        return span({
                            style: {
                                color: 'black'
                            }
                        }, dateFormat(appStatus.finished_epoch_ms));
                }
            }

            // {
            //     app: "A1",
            //     app_title: "Orthology GO profiles",
            //     finished_epoch_ms: 1504207620568,
            //     job_id: "12346769",
            //     new_re_links: 23748234,
            //     new_re_nodes: 12767346,
            //     output: "<output>",
            //     queued_epoch_ms: 1504207610568,
            //     scheduled_epoch_ms: 1504964180656,
            //     started_epoch_ms: 1504207615568,
            //     state: "finished",
            //     updated_re_nodes: 165246,
            //     user: "kbadmin"
            // }

            // Kick off the apps status population.
            function updateAppStatus() {
                return getAppsStatus()
                    .then(function(newAppsStatus) {
                        appsStatus.removeAll();
                        newAppsStatus.forEach(function(appStatus) {

                            // if (appStatus.state === 'queued') {
                            //     console.log(appStatus);
                            // }

                            var stateIcon = buildStateIcon(appStatus.state);
                            var lastRunAt = buildLastRunAt(appStatus);

                            var newStatus = {
                                app: appStatus.app,
                                name: appStatus.app_title,
                                status: appStatus.state,
                                statusIcon: stateIcon,
                                updatedNodes: numeral(appStatus.updated_re_nodes).format('0,0'),
                                newNodes: numeral(appStatus.new_re_nodes).format('0,0'),
                                newRelations: numeral(appStatus.new_re_links).format('0,0'),
                                lastRunAt: lastRunAt,
                                nextRunAt: dateFormat(appStatus.scheduled_epoch_ms)

                            };

                            var hasNeverBeenRun = appStatus.queued_epoch_ms === 0 ? true : false;
                            var isRunning = (appStatus.state === 'queued' || appStatus.state === 'started');
                            var dataPending = span({
                                class: 'fa fa-spinner fa-spin fa-fw'
                            });

                            dataPending = span({
                                style: {
                                    color: 'silver'
                                }
                            }, '-');

                            var dataNever = span({
                                class: 'fa fa-ban',
                                style: {
                                    color: 'silver'
                                }
                            });

                            if (isRunning) {
                                newStatus.newNodes = dataPending;
                                newStatus.newRelations = dataPending;
                                newStatus.updatedNodes = dataPending;
                            } else if (hasNeverBeenRun) {
                                newStatus.newNodes = dataNever;
                                newStatus.newRelations = dataNever;
                                newStatus.updatedNodes = dataNever;
                            } else {
                                newStatus.updatedNodes = numeral(appStatus.updated_re_nodes).format('0,0');
                                newStatus.newNodes = numeral(appStatus.new_re_nodes).format('0,0');
                                newStatus.newRelations = numeral(appStatus.new_re_links).format('0,0');
                            }

                            appsStatus.push(newStatus);
                        });

                        return newAppsStatus;
                    });
            }

            var connectorsStatus = ko.observableArray();

            // {
            //     connector_app: "GenomeHomologyConnector",
            //     connector_title: "Genome homology connector",
            //     finished_epoch_ms: 1504150038840,
            //     job_id: "12346712",
            //     new_re_links: 4858,
            //     new_re_nodes: 4858,
            //     obj_ref: "<obj_ref>",
            //     obj_type: "<obj_type>",
            //     output: "<output>",
            //     queued_epoch_ms: 1504144050840,
            //     started_epoch_ms: 1504144099840,
            //     state: "finished",
            //     updated_re_nodes: 0,
            //     user: "psnovichkov"
            // }

            function updateConnectorStatus() {
                return getConnectorsStatus()
                    .then(function(newConnectorsStatus) {
                        connectorsStatus.removeAll();
                        newConnectorsStatus.forEach(function(status) {
                            var stateIcon = buildStateIcon(status.state);
                            var newStatus = {
                                user: status.user,
                                name: status.connector_title,
                                objectRef: status.obj_ref,
                                status: status.state,
                                statusIcon: stateIcon,
                                lastRunAt: dateFormat(status.finished_epoch_ms),

                            };
                            var hasNeverBeenRun = status.queued_epoch_ms === 0 ? true : false;
                            var isRunning = (status.state === 'queued' || status.state === 'started');
                            var dataPending = span({
                                class: 'fa fa-spinner fa-spin fa-fw'
                            });
                            dataPending = span({
                                style: {
                                    color: 'silver'
                                }
                            }, '-');

                            var dataNever = span({
                                class: 'fa fa-ban'
                            });

                            if (isRunning) {
                                newStatus.newNodes = dataPending;
                                newStatus.newRelations = dataPending;
                                newStatus.updatedNodes = dataPending;
                            } else if (hasNeverBeenRun) {
                                newStatus.newNodes = dataNever;
                                newStatus.newRelations = dataNever;
                                newStatus.updatedNodes = dataNever;
                            } else {
                                newStatus.updatedNodes = numeral(status.updated_re_nodes).format('0,0');
                                newStatus.newNodes = numeral(status.new_re_nodes).format('0,0');
                                newStatus.newRelations = numeral(status.new_re_links).format('0,0');
                            }

                            connectorsStatus.push(newStatus);
                        });
                        return newConnectorsStatus;
                    });
            }

            var pollStatus = ko.observable('idle');
            var poller = Poller();
            poller.start({
                name: 'updater',
                interval: normalPollingInterval,
                runInitial: true,
                task: function() {
                    message('polling...');
                    pollStatus('busy');
                    var start = new Date().getTime();
                    return Promise.all([
                            updateAppStatus(),
                            updateConnectorStatus()
                        ])
                        .spread(function(appsStatus, connectorStatus) {

                            if (
                                appsStatus.some(function(status) {
                                    return (['accepted', 'queued', 'started'].indexOf(status.state) >= 0);
                                })
                                // ||
                                // connectorStatus.some(function(status) {
                                //     return (['accepted', 'queued', 'started'].indexOf(status.state) >= 0);
                                // })
                            ) {
                                jobsRunning(true);
                            } else {
                                jobsRunning(false);
                            }


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
                    }, BS.buildTabs({
                        style: {
                            paddingTop: '12px'
                        },
                        tabs: [{
                            name: 'appstatus',
                            title: 'KE App Status',
                            body: div({
                                dataBind: {
                                    component: {
                                        name: '"reske-admin-apps-status"',
                                        params: {
                                            appsStatus: 'appsStatus',
                                            doRunAppStatus: 'doRunAppStatus'
                                        }
                                    }
                                }
                            })
                        }, {
                            name: 'connectionstatus',
                            title: 'KE Connection Status',
                            body: div({
                                dataBind: {
                                    component: {
                                        name: '"reske-admin-connectors-status"',
                                        params: {
                                            connectorsStatus: 'connectorsStatus'
                                        }
                                    }
                                }
                            })
                        }]
                    }).content)
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