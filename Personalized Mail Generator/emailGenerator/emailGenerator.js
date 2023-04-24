import { LightningElement, track, wire, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import Id from '@salesforce/user/Id';
import { getRecord } from 'lightning/uiRecordApi';
import UserNameFIELD from '@salesforce/schema/User.Name';
import generateEmail from '@salesforce/apex/OpenAIEmailGenerator.generateEmail';
import sendEmailController from '@salesforce/apex/OpenAIEmailGenerator.sendEmailController';

export default class EmailGenerator extends LightningElement {
    toAddress = [];
    ccAddress = [];
    receipientList = [];
    @track subject = '';
    wantToUploadFile = false;
    noEmailError = false;
    invalidEmails = false;
    documentIds = [];
    @track error;
    @track userId = Id;
    @track currentUserName;
    @track body = '';
    @track prompt = ''; 
    @track showSpinner = false;
    @track emailContent = '';
    @track files = [];
    @api myRecordId;

    @wire(CurrentPageReference) pageRef;

    @wire(getRecord, { recordId: Id, fields: [ UserNameFIELD ]})
    currentUserInfo({error, data}) {
        if (data) {
            this.currentUserName = data.fields.Name.value;
        } else if (error) {
            this.error = error ;
        }
    }

    handlePromptChange(event){
        this.prompt = event.target.value;
    }

    async generateEmail() {
        this.noEmailError = false;
        if(!this.toAddress.length>0){
            this.noEmailError = true;
            return;
        }
        if (this.prompt) {
            this.showSpinner = true;
            this.emailContent = await generateEmail({ p: this.prompt }).then(
                (response)=>{
                    console.log('Email Generated Succesfully');
                    return response;
                }
            ).catch((error)=>{
                console.log('Error in generateEmail Controller: ',error);
                this.showSpinner = false;
                this.showToastMsg('ERROR', error.body.message, 'error');
            });
            this.emailContentModifier(this.emailContent);
        }
    }

    // Method to modify the mail content
    emailContentModifier(content){
        let txt = content;
        if(txt.startsWith("Subject:") || txt.startsWith("Subject Line:")){
            let sTxt = txt.substring(txt.indexOf(':')+1,txt.indexOf(',')).replaceAll(/(\r\n|\n|\r)/gm,' ').replace('  ',' ').trim();
            let subLine = sTxt.split(' ');
            let addSubjectTxt = '';
            for(let i=0; i<subLine.length-2; i++){
                addSubjectTxt += subLine[i]+' ';
            }
            this.subject = addSubjectTxt.trim();
            let bTxt = txt.substring(0,txt.indexOf(',')).replaceAll(/(\r\n|\n|\r)/gm,' ').replace('  ',' ').trim();
            let bodyLine = bTxt.split(' ');
            let removalTxt = '';
            for(let i=0; i<bodyLine.length-2; i++){
                removalTxt += bodyLine[i]+' ';
            }
            this.body = txt.replace(removalTxt.trim(),'').trim();
        }else{
            this.subject = '';
            this.body = txt;
        }
        this.body = this.toAddress.length == 1 ? this.body.replace('[Name]',this.receipientList[0].split(' ')[0]) : this.body.replace('[Name]', 'Sir/Madam');
        this.body = this.body.replace('[Your Name]',this.currentUserName);
        this.showSpinner = false;
        this.showToastMsg('SUCCESS', 'Email Generated Successfully', 'success');
    }

    toggleFileUpload() {
        this.wantToUploadFile = !this.wantToUploadFile;
    }
    
    get acceptedFormats() {
        return ['.pdf', '.png', '.xlsx', '.xls', '.csv'];
    }

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        this.files = [...this.files, ...uploadedFiles];
        this.wantToUploadFile = false;
    }

    handleRemove(event) {
        const index = event.target.dataset.index;
        this.files.splice(index, 1);
    }

    handleToAddressChange(event) {
        this.toAddress = event.detail.selectedValues;
    }

    handleReceipientName(event) {
        this.receipientList = event.detail.selectedNames;
    }

    handleCcAddressChange(event) {
        this.ccAddress = event.detail.selectedValues;
    }

    handleSubjectChange(event) {
        this.subject = event.target.value;
    }

    handleBodyChange(event) {
        this.body = event.target.value;
    }

    validateEmails(emailAddressList) {
        let areEmailsValid;
        if(emailAddressList.length > 1) {
            areEmailsValid = emailAddressList.reduce((accumulator, next) => {
                const isValid = this.validateEmail(next);
                return accumulator && isValid;
            });
        }
        else if(emailAddressList.length > 0) {
            areEmailsValid = this.validateEmail(emailAddressList[0]);
        }
        return areEmailsValid;
    }

    validateEmail(email) {
        console.log("In VE");
        const res = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()s[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        console.log("res", res);
        return res.test(String(email).toLowerCase());
    }

    handleReset() {
        this.toAddress = [];
        this.ccAddress = [];
        this.subject = "";
        this.body = "";
        this.prompt = "";
        this.files = [];
        this.receipientList = [];
        this.noEmailError = false;
        this.invalidEmails = false;
        this.template.querySelectorAll("c-email-input").forEach((input) => input.reset());
    }

    // Toast Evt Dispatch..
    showToastMsg(_title, _message, _variant){
        const evt = new ShowToastEvent({
            title: _title,
            message: _message,
            variant: _variant
        });
        this.dispatchEvent(evt);
    }

    handleSendEmail() {
        this.showSpinner = true;
        this.noEmailError = false;
        this.invalidEmails = false;
        if (![...this.toAddress, ...this.ccAddress].length > 0) {
            this.noEmailError = true;
            this.showSpinner = false;
            return;
        }
        
        if (!this.validateEmails([...this.toAddress, ...this.ccAddress])) {
            this.invalidEmails = true;
            this.showSpinner = false;
            return;
        }

        // logic for handling multiple file attachment
        if(this.files.length>0){
            for(let i=0; i < this.files.length; i++) {
                this.documentIds.push(this.files[i].documentId);
            }
        }   

        let emailDetails = {
            toAddress: this.toAddress,
            ccAddress: this.ccAddress,
            subject: this.subject,
            body: this.body,
            files: this.documentIds
        };

        sendEmailController({ emailDetailStr: JSON.stringify(emailDetails) })
            .then(() => {
                console.log("Email Sent");
                this.showSpinner = false;
                this.showToastMsg('SUCCESS', 'Email Sent Successfully', 'success');
            })
            .catch((error) => {
                console.error("Error in sendEmailController:", error);
                this.showSpinner = false;
                this.showToastMsg('ERROR', error.body.message, 'error');
            });
    }
}