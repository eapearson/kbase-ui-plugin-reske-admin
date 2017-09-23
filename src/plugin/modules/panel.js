define([
    'bluebird',
    'knockout-plus',
    'numeral',
    'moment',
    'kb_common/html',
    'kb_common/bootstrapUtils',
    'kb_common/jsonRpc/dynamicServiceClient'
], function (
    Promise,
    ko,
    numeral,
    moment,
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
        var runningPollingInterval = 5000;

        function dateFormat(time, defaultValue) {
            if (!time) {
                return defaultValue;
            }
            var date = new Date(time);
            return [date.getMonth() + 1, date.getDate(), date.getFullYear()].join('/');
        }

        // Nah, just a single-task poller.
        function Poller() {
            var running = false;
            var task;
            var currentPoll = {
                id: null,
                timer: null,
                cancelled: false
            };
            var lastId = 0;

            function nextId() {
                lastId += 1;
                return lastId;
            }

            function start(theTask) {
                task = theTask;
                task.lastRun = null;
                running = true;
                if (task.runInitial) {
                    runTask()
                        .then(function () {
                            poll();
                        });
                } else {
                    poll();
                }
            }

            function stop() {
                running = false;
            }

            function timestamp() {
                return new Date().toLocaleString();
            }

            function runTask() {
                var start = new Date().getTime();
                return task.task()
                    .catch(function (err) {
                        console.error(timestamp() + ': Error while running task', err);
                    })
                    .finally(function () {
                        // console.log(timestamp() + ': ran task in ' + (new Date().getTime() - start) + 'ms');
                    });
            }

            function poll() {
                // If we aren't polling at all, ignore.
                if (!running) {
                    return;
                }

                // If called when a poll is already waiting, just ignore.
                // The proper way is to cancel the original one.
                if (currentPoll.timer) {
                    return;
                }

                // This is the global current poll. It can be touched during cancellation
                // to signal to the timer which has captured it to halt.
                currentPoll = {
                    timer: null,
                    id: nextId(),
                    cancelled: false
                };

                currentPoll.timer = window.setTimeout(function () {
                    // Store a private reference so new pollers don't interfere if they are 
                    // created while we are still running.
                    var thisPoll = currentPoll;
                    if (thisPoll.cancelled) {
                        // don't do it!                        
                        console.warn('poll cancelled! ' + thisPoll.id);
                    }
                    runTask()
                        .finally(function () {
                            thisPoll.timer = null;
                            poll();
                        });
                }, task.interval);
            }

            function cancelCurrentPoll() {
                if (currentPoll.timer) {
                    window.clearTimeout(currentPoll.timer);
                    currentPoll.timer = null;
                    currentPoll.cancelled = true;
                }
            }

            function force() {
                if (!running) {
                    running = true;
                } else {
                    cancelCurrentPoll();
                }
                runTask()
                    .then(function () {
                        poll();
                    });
            }

            function restart() {
                if (!running) {
                    running = true;
                } else {
                    cancelCurrentPoll();
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


            var jobsRunning = ko.observable(false);

            jobsRunning.subscribe(function (newValue) {
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
                    .spread(function (result) {
                        return result;
                    });
            }

            function getConnectorsStatus() {
                return client.callFunc('getConnectorsStatus', [])
                    .spread(function (result) {
                        return result;
                    });
            }

            function doRunAppClean(data) {
                var params = {
                    app: data.app
                };
                return client.callFunc('cleanAppData', [params])
                    .then(function (result) {
                        // NOTE usage of "then" -- this app returns null, not [] or [null] 
                        // or whatever. This is a corner case of sdk app api weirdness.
                        poller.force();
                        return result;
                    })
                    .catch(function (err) {
                        console.error('Error', err);
                    });
            }

            function doRunAppStatus(data) {
                var params = {
                    app: data.app,
                    ref_mode: 1
                };
                return client.callFunc('runApp', [params])
                    .spread(function (result) {
                        poller.force();
                        return result;
                    })
                    .catch(function (err) {
                        console.error('Error', err);
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

            function buildNoData() {
                return span({
                    style: {
                        color: 'silver'
                    }
                }, '-');
            }

            function buildStateIcon(state) {
                switch (state) {
                case 'none':
                    return icon('ban', 'silver');
                case 'accepted':
                    return span([
                        span({
                            class: 'fa fa-spinner fa-spin fa-fw',
                            style: {
                                color: 'silver'
                            }
                        }),
                        ' ',
                        state
                    ]);
                case 'queued':
                    return span([
                        span({
                            class: 'fa fa-spinner fa-spin fa-fw',
                            style: {
                                color: 'orange'
                            }
                        }),
                        ' ',
                        state
                    ]);
                case 'started':
                    return span([
                        span({
                            class: 'fa fa-spinner fa-spin fa-fw',
                            style: {
                                color: 'blue'
                            }
                        }),
                        ' ',
                        state
                    ]);
                case 'finished':
                    return icon('check', 'green');
                case 'error':
                    return icon('exclamation-circle', 'red');
                default:
                    if (state === undefined) {
                        return buildNoData();
                    } else {
                        return span('? ' + state);
                    }
                }
            }

            function buildIsRunnable(state) {
                switch (state) {
                case 'none':
                    return false;
                case 'accepted':
                    return false;
                case 'queued':
                    return false;
                case 'started':
                    return false;
                case 'finished':
                    return true;
                case 'error':
                    return true;
                default:
                    // this should probably be an error...
                    return true;
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
                case 'accepted':
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, '-');
                case 'queued':
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, dateFormat(appStatus.queued_epoch_ms, 'never'));
                case 'started':
                    return span({
                        style: {
                            color: 'gray'
                        }
                    }, dateFormat(appStatus.started_epoch_ms, 'never'));
                case 'finished':
                    return span({
                        style: {
                            color: 'black'
                        }
                    }, dateFormat(appStatus.finished_epoch_ms, 'never'));
                case 'error':
                    return span({
                        style: {
                            color: 'red'
                        }
                    }, dateFormat(appStatus.finished_epoch_ms, 'never'));
                default:
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, dateFormat(appStatus.finished_epoch_ms, 'never'));
                }
            }

            function buildNextRunAt(appStatus) {
                switch (appStatus.state) {
                case 'none':
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, 'never');
                case 'accepted':
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, '-');
                case 'queued':
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, dateFormat(appStatus.scheduled_epoch_ms, 'never'));
                case 'started':
                    return span({
                        style: {
                            color: 'gray'
                        }
                    }, dateFormat(appStatus.scheduled_epoch_ms, 'never'));
                case 'finished':
                    return span({
                        style: {
                            color: 'black'
                        }
                    }, dateFormat(appStatus.scheduled_epoch_ms, 'never'));
                case 'error':
                    return span({
                        style: {
                            color: 'black'
                        }
                    }, dateFormat(appStatus.scheduled_epoch_ms, 'never'));

                default:
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, dateFormat(appStatus.scheduled_epoch_ms, 'never'));
                }
            }

            function buildMeasure(value, status) {
                var config = {
                    none: {
                        color: 'black'
                    },
                    accepted: {
                        color: 'gray'
                    },
                    queued: {
                        color: 'orange'
                    },
                    started: {
                        color: 'blue'
                    },
                    finished: {
                        color: 'black'
                    },
                    error: {
                        color: 'red'
                    }
                };

                var statusConfig = config[status];
                if (statusConfig) {
                    return span({
                        style: {
                            color: statusConfig.color
                        }
                    }, numeral(value).format('0,0'));
                } else {
                    return span({
                        style: {
                            color: 'silver'
                        }
                    }, '-');
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
                    .then(function (newAppsStatus) {
                        appsStatus.removeAll();
                        newAppsStatus.forEach(function (appStatus) {

                            // if (appStatus.state === 'queued') {
                            //     console.log(appStatus);
                            // }

                            var stateIcon = buildStateIcon(appStatus.state);
                            var lastRunAt = buildLastRunAt(appStatus);

                            var isRunnable = buildIsRunnable(appStatus.state);

                            var newStatus = {
                                app: appStatus.app,
                                name: appStatus.app_title,
                                status: appStatus.state,
                                statusIcon: stateIcon,
                                updatedNodes: numeral(appStatus.updated_re_nodes).format('0,0'),
                                newNodes: numeral(appStatus.new_re_nodes).format('0,0'),
                                newRelations: numeral(appStatus.new_re_links).format('0,0'),
                                lastRunAt: lastRunAt,
                                nextRunAt: buildNextRunAt(appStatus), // dateFormat(appStatus.scheduled_epoch_ms),
                                isRunnable: isRunnable
                            };

                            // var hasNeverBeenRun = appStatus.queued_epoch_ms === 0 ? true : false;
                            // var isRunning = (appStatus.state === 'accepted' || appStatus.state === 'queued' || appStatus.state === 'started');
                            // var dataPending = span({
                            //     style: {
                            //         color: 'silver'
                            //     }
                            // }, '-');

                            // var dataNever = span({
                            //     class: 'fa fa-ban',
                            //     style: {
                            //         color: 'silver'
                            //     }
                            // });

                            newStatus.newNodes = buildMeasure(appStatus.new_re_nodes, appStatus.state);
                            newStatus.newRelations = buildMeasure(appStatus.new_re_links, appStatus.state);
                            newStatus.updatedNodes = buildMeasure(appStatus.updated_re_nodes, appStatus.state);

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
                    .then(function (newConnectorsStatus) {
                        connectorsStatus.removeAll();
                        newConnectorsStatus.reverse().forEach(function (status) {
                            var stateIcon = buildStateIcon(status.state);
                            var newStatus = {
                                user: status.user,
                                name: status.connector_title,
                                objectRef: status.obj_ref,
                                status: status.state,
                                statusIcon: stateIcon,
                                lastRunTime: status.finished_epoch_ms,
                                lastRunAt: status.finished_epoch_ms ? moment(status.finished_epoch_ms).format('MM/DD/YYYY hh:mm A') : '-'
                            };
                            // var hasNeverBeenRun = status.queued_epoch_ms === 0 ? true : false;
                            // var isRunning = (status.state === 'accepted' || status.state === 'queued' || status.state === 'started');
                            // var dataPending = span({
                            //     style: {
                            //         color: 'silver'
                            //     }
                            // }, '-');

                            // var dataNever = span({
                            //     class: 'fa fa-ban'
                            // });

                            newStatus.newNodes = buildMeasure(status.new_re_nodes, status.state);
                            newStatus.newRelations = buildMeasure(status.new_re_links, status.state);
                            newStatus.updatedNodes = buildMeasure(status.updated_re_nodes, status.state);

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
                task: function () {
                    // message('polling...');
                    pollStatus('busy');
                    var start = new Date().getTime();
                    return Promise.all([
                            updateAppStatus(),
                            updateConnectorStatus()
                        ])
                        .spread(function (appsStatus, connectorStatus) {

                            if (
                                appsStatus.some(function (status) {
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
                            // console.log('poller took: ' + elapsed + 'ms');
                        })
                        .finally(function () {
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
                doRunAppClean: doRunAppClean,

                // status
                message: message,
                pollStatus: pollStatus,

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
                                    message: 'message',
                                    pollStatus: 'pollStatus'
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
                                            doRunAppStatus: 'doRunAppStatus',
                                            doRunAppClean: 'doRunAppClean'
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
        make: function (config) {
            return factory(config);
        }
    };
});