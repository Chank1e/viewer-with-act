import { OHIF } from 'meteor/ohif:core';

Template.measurementTableTimepointCell.helpers({
    hasDataAtThisTimepoint() {
        // This simple function just checks whether or not timepoint data
        // exists for this Measurement at this Timepoint
        const instance = Template.instance();
        const rowItem = instance.data.rowItem;
        const timepointId = instance.data.timepointId;

        if (timepointId) {
            const dataAtThisTimepoint = _.where(rowItem.entries, { timepointId });
            return dataAtThisTimepoint.length > 0;
        } else {
            return rowItem.entries.length > 0;
        }
    },
    displayData() {
        const instance = Template.instance();
        const rowItem = instance.data.rowItem;
        const timepointId = instance.data.timepointId;

        let data;
        if (timepointId) {
            const dataAtThisTimepoint = _.where(rowItem.entries, { timepointId });
            if (dataAtThisTimepoint.length > 1) {
                throw 'More than one measurement was found at the same timepoint with the same measurement number?';
            }
            data = dataAtThisTimepoint[0];
        } else {
            data = rowItem.entries[0];
        }

        const config = OHIF.measurements.MeasurementApi.getConfiguration();
        const measurementTools = config.measurementTools;

        const toolGroup = _.findWhere(measurementTools, { id: rowItem.measurementTypeId });
        const tool = _.findWhere(toolGroup.childTools, { id: data.toolType });
        if (!tool) {
            // TODO: Figure out what is going on here?
            console.warn('Something went wrong?');
        }
        const displayFunction = tool.options.measurementTable.displayFunction;
        return displayFunction(data);
    }
});

function doneCallback(measurementData, deleteTool) {
    // If a Lesion or Non-Target is removed via a dialog
    // opened by the Lesion Table, we should clear the data for
    // the specified Timepoint Cell
    if (deleteTool === true) {
        OHIF.log.info('Confirm clicked!');
        OHIF.lesiontracker.clearMeasurementTimepointData(measurementData.id, measurementData.timepointId);
    }
}

// Delete a lesion if Ctrl+D or DELETE is pressed while a lesion is selected
const keys = {
    D: 68,
    DELETE: 46
};

Template.measurementTableTimepointCell.events({
    'click .measurementTableTimepointCell'(event, instance) {
        if (!instance.data.timepointId) {
            return;
        }

        const rowItem = instance.data.rowItem;
        const timepoints = instance.data.timepoints.get();
        OHIF.measurements.jumpToRowItem(rowItem, timepoints);
    },
    
    'keydown .measurementTableTimepointCell'(event, instance) {
        const keyCode = event.which;

        if (keyCode === keys.DELETE || keyCode === keys.BACKSPACE || (keyCode === keys.D && event.ctrlKey === true)) {
            const currentMeasurement = Template.parentData(1).rowItem;
            const timepointId = this.timepointId;
            
            const dialogSettings = {
                title: 'Delete measurements',
                message: 'Are you sure you want to delete this measurement?'
            };

            OHIF.ui.showFormDialog('dialogConfirm', dialogSettings).then(() => {
                const measurementTypeId = instance.data.rowItem.measurementTypeId;
                const measurement = instance.data.rowItem.entries[0];
                const measurementNumber = measurement.measurementNumber;
                const measurementApi = instance.data.measurementApi;
                const timepointApi = instance.data.timepointApi;

                // Remove all the measurements with the given type and number
                measurementApi.deleteMeasurements(measurementTypeId, {
                    measurementNumber,
                    timepointId
                });

                // Sync the new measurement data with cornerstone tools
                const baseline = timepointApi.baseline();
                measurementApi.sortMeasurements(baseline.timepointId);

                // Repaint the images on all viewports without the removed measurements
                _.each($('.imageViewerViewport'), element => cornerstone.updateImage(element));
            });
        }
    }
});
