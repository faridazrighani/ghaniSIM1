(function () {
    window.TOOLBAR_GROUPS = [
        {
            id: 'equipment',
            label: 'Equipment',
            items: [
                { type: 'pump', label: 'Pump', icon: 'toolbar/icons/pump.svg' },
                { type: 'tank', label: 'Tank', icon: 'toolbar/icons/tank.svg' },
                { type: 'separator', label: 'Vessel H', icon: 'toolbar/icons/vessel.svg' },
                { type: 'verticalVessel', label: 'Vessel V', icon: 'toolbar/icons/vertical-vessel.svg' },
                { type: 'heatExchanger', label: 'Exchanger', icon: 'toolbar/icons/heat-exchanger.svg' }
            ]
        },
        {
            id: 'piping',
            label: 'Piping',
            items: [
                { type: 'valve', label: 'Valve', icon: 'toolbar/icons/valve.svg' }
            ]
        },
        {
            id: 'pipesim',
            label: 'PIPESIM',
            items: [
                { type: 'source', label: 'Source', icon: 'toolbar/icons/source.svg' },
                { type: 'sink', label: 'Sink', icon: 'toolbar/icons/sink.svg' }
            ]
        },
        {
            id: 'instruments',
            label: 'Instruments',
            items: [
                { type: 'lineMonitor', label: 'PTF', icon: 'toolbar/icons/line-monitor.svg' },
                { type: 'levelController', label: 'LIC', icon: 'toolbar/icons/level-controller.svg' }
            ]
        }
    ];
}());
