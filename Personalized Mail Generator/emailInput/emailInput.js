import { LightningElement, track, api } from 'lwc';
import search from '@salesforce/apex/OpenAIEmailGenerator.search';
import getGroupedEmails from '@salesforce/apex/OpenAIEmailGenerator.getGroupedEmails';

export default class EmailInput extends LightningElement {
    @track items = [];
    searchTerm = "";
    blurTimeout;
    boxClass = "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-has-focus";

    _selectedValues = [];
    _selectedNames = [];
    selectedValuesMap = new Map();

    get selectedValues() {
        return this._selectedValues;
    }

    set selectedValues(value) {
        this._selectedValues = value;
        const selectedValuesEvent = new CustomEvent("selection", { detail: { selectedValues: this._selectedValues } });
        this.dispatchEvent(selectedValuesEvent);
    }

    get selectedNames() {
        return this._selectedNames;
    }

    set selectedNames(value) {
        this._selectedNames = value;
        const selectedNamesEvent = new CustomEvent("send", { detail: { selectedNames: this._selectedNames } });
        this.dispatchEvent(selectedNamesEvent);
    }

    handleInputChange(event) {
        event.preventDefault();
        if (event.target.value.length < 3) {
            return;
        }

        search({ searchString: event.target.value })
            .then((result) => {
                this.items = result;
                if (this.items.length > 0) {
                    this.boxClass =
                        "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-has-focus slds-is-open";
                }
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    handleBlur() {
        console.log("In onBlur");
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.blurTimeout = setTimeout(() => {
            this.boxClass = "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-has-focus";
            const value = this.template.querySelector('input.input').value
            if (value !== undefined && value != null && value !== "") {
                this.selectedValuesMap.set(value, value);
                this.selectedValues = [...this.selectedValuesMap.keys()];
                this.selectedNames = [...this.selectedValuesMap.values()];
            }

            this.template.querySelector('input.input').value = "";
        }, 300);
    }

    get hasItems() {
        return this.items.length;
    }

    handleKeyPress(event) {
        if (event.keyCode === 13) {
            event.preventDefault(); // Ensure it is only this code that runs

            const value = this.template.querySelector('input.input').value;
            if (value !== undefined && value != null && value !== "") {
                this.selectedValuesMap.set(value, value);
                this.selectedValues = [...this.selectedValuesMap.keys()];
                this.selectedNames = [...this.selectedValuesMap.values()];
            }
            this.template.querySelector('input.input').value = "";
        }
    }

    handleRemove(event) {
        const item = event.target.label;
        this.selectedValuesMap.delete(item);
        this.selectedValues = [...this.selectedValuesMap.keys()];
        this.selectedNames = [...this.selectedValuesMap.values()];
    }

    async onSelect(event) {
        this.template.querySelector('input.input').value = "";
        let ele = event.currentTarget;
        let selectedId = ele.dataset.id;
        let selectedValue = this.items.find((record) => record.Id === selectedId);
        //Newly Added functionality for Grouped Emails
        selectedValue.hasOwnProperty('Email') ? this.selectedValuesMap.set(selectedValue.Email, selectedValue.Name) : 
        await getGroupedEmails({ recId : selectedId })
        .then((result) =>{
            result.forEach((element)=>{
                this.selectedValuesMap.set(element.Email, element.Name);
            }
            );
        })
        .catch((error) => {
                console.error("Error:", error);
        });
        this.selectedValues = [...this.selectedValuesMap.keys()];
        this.selectedNames = [...this.selectedValuesMap.values()];

        //As a best practise sending selected value to parent and inreturn parent sends the value to @api valueId
        let key = this.uniqueKey;
        const valueSelectedEvent = new CustomEvent("valueselect", {
            detail: { selectedId, key }
        });
        this.dispatchEvent(valueSelectedEvent);

        if (this.blurTimeout) {
            clearTimeout(this.blurTimeout);
        }
        this.boxClass = "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-has-focus";
    }

    @api reset() {
        this.selectedValuesMap = new Map();
        this.selectedValues = [];
        this.selectedNames = [];
    }

    @api validate() {
        this.template.querySelector('input').reportValidity();
        const isValid = this.template.querySelector('input').checkValidity();
        return isValid;
    }
}