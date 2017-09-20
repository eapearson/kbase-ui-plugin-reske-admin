define([
    'kb_common/html',
    'knockout-plus',
    'kb_common/bootstrapUtils'
], function (
    html,
    ko,
    BS
) {
    'use strict';

    var t = html.tag,
        div = t('div'),
        button = t('button'),
        table = t('table'),
        colgroup = t('colgroup'),
        col = t('col'),
        thead = t('thead'),
        tr = t('tr'),
        td = t('td'),
        th = t('th'),
        tbody = t('tbody');

    function viewModel(params) {
        return {
            appsStatus: params.appsStatus,
            doRunAppStatus: params.doRunAppStatus,
            doRunAppClean: params.doRunAppClean
        };
    }

    function buildTable() {
        return table({
            class: 'table table-striped'
        }, [
            colgroup([
                col(),
                col(),
                col(),
                col(),
                col(),
                col(),
                col(),
                col()
            ]),
            thead([
                tr([
                    th('Name'),
                    th({
                        style: {
                            textAlign: 'center'
                        }
                    }, 'Status'),
                    th('New Nodes'),
                    th('New Relations'),
                    th('Last ran'),
                    th('Next run'),
                    th()
                ])
            ]),
            tbody({
                dataBind: {
                    foreach: 'appsStatus'
                }
            }, tr([
                td({
                    dataBind: {
                        text: 'name'
                    }
                }),
                td({
                    dataBind: {
                        html: 'statusIcon'
                    },
                    style: {
                        textAlign: 'center'
                    }
                }),
                td({
                    dataBind: {
                        html: 'newNodes'
                    }
                }),
                td({
                    dataBind: {
                        html: 'newRelations'
                    }
                }),
                td({
                    dataBind: {
                        html: 'lastRunAt'
                    }
                }),
                td({
                    dataBind: {
                        html: 'nextRunAt'
                    }
                }),
                td(
                    div({
                        class: 'btn-group'
                    }, [
                        button({
                            class: 'btn btn-default',
                            dataBind: {
                                click: '$component.doRunAppClean',
                                disable: '!isRunnable'
                            }
                        }, 'Clean'),
                        button({
                            class: 'btn btn-primary',
                            dataBind: {
                                click: '$component.doRunAppStatus',
                                disable: '!isRunnable'
                            }
                        }, 'Run')
                    ])
                )
            ]))
        ]);
    }

    function template() {
        return div({
            class: 'component-reske-admin-apps-status',
        }, buildTable());
    }

    function component() {
        return {
            viewModel: viewModel,
            template: template()
        };
    }
    return component;

});