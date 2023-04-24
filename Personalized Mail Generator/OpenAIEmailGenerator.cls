public with sharing class OpenAIEmailGenerator {
    @AuraEnabled
    public static String generateEmail(String p) {
        String key = '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';
        String orgId = 'org-vRnaE6v9tI8cQbJZkgBks3Yd';
        String prompt = p;
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.openai.com/v1/completions');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer '+key);
        req.setHeader('OpenAI-Organization', ''+orgId);
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000);
        String requestBody = JSON.serialize(new OpenAIRequest('text-davinci-003', prompt, 300, 0.2, 1.0, 1));
        req.setBody(requestBody);
        HttpResponse res = http.send(req);
        if (res.getStatusCode() == 200) {
            OpenAIResponse response = (OpenAIResponse) JSON.deserialize(res.getBody(), OpenAIResponse.class);
            return response.choices[0].text.trim();
        } else {
            return 'Error: ' + res.getStatus();
        }
    }

    @AuraEnabled
    public static List<SObject> search(String searchString) {
        List<SObject> searchList = new List<SObject>();
        try {
            String searchStr = '*' + searchString + '*';
            String searchquery =
                'FIND\'' +
                searchStr +
                '\'IN ALL FIELDS RETURNING Contact(id, name, email where email != null), User(id, name, email where email != null AND isActive = true), Grouped_Contact__c(id, name) LIMIT 10';
            List<List<SObject>> searchResult = search.query(searchquery);
            for (List<SObject> curList : searchResult) {
                searchList.addAll(curList);
            }
            system.debug('searchList:::' + searchList.size());
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return searchList;
    }

    @AuraEnabled
    public static List<SObject> getGroupedEmails(String recId){
        try {
            List<SObject> ctcList = [ SELECT Id, Email, Name FROM Contact WHERE Grouped_Contact__c =: recId ];
            if(ctcList.size()>0) return ctcList;
            return null;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void sendEmailController(String emailDetailStr) {
        EmailWrapper emailDetails = (EmailWrapper) JSON.deserialize(emailDetailStr, EmailWrapper.class);
        List<Messaging.EmailFileAttachment> attachments = new List<Messaging.EmailFileAttachment>();
        Messaging.reserveSingleEmailCapacity(1);
        try {
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            if(emailDetails.files.size()>0){
                for(ContentVersion contentVersion : [ SELECT Id, Title, FileType, VersionData FROM ContentVersion WHERE ContentDocumentId IN : emailDetails.files ]){
                    Messaging.EmailFileAttachment attach = new Messaging.EmailFileAttachment();
                    attach.setFileName(contentVersion.Title);
                    attach.setBody(contentVersion.VersionData);
                    attachments.add(attach);
                }
                mail.setFileAttachments(attachments);
            }
            mail.setToAddresses(emailDetails.toAddress);
            mail.setCcAddresses(emailDetails.ccAddress);
            mail.setReplyTo('test.k@xyz.com');
            mail.setSenderDisplayName('Test');
            mail.setSubject(emailDetails.subject);
            mail.setHtmlBody(emailDetails.body);
            Messaging.sendEmail(new List<messaging.SingleEmailMessage>{ mail });
        } catch (exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class EmailWrapper {
        public List<String> toAddress;
        public List<String> ccAddress;
        public String subject;
        public String body;
        public List<String> files;
    }

    private class OpenAIRequest {
        String model;
        String prompt;
        Integer max_tokens;
        Decimal temperature;
        Decimal top_p;
        Integer n;
        public OpenAIRequest(String model, String prompt, Integer max_tokens, 
                            Decimal temperature, Decimal top_p, Integer n) {
            this.model = model;
            this.prompt = prompt;
            this.max_tokens = max_tokens;
            this.temperature = temperature;
            this.top_p = top_p;
            this.n = n;
        }
    }

    private class OpenAIResponse {
        List<OpenAIChoice> choices;
    }

    private class OpenAIChoice {
        String text;
    }
}