{{- define "ktc-service.name" -}}
{{- default .Values.name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ktc-service.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "ktc-service.name" . -}}
{{- end -}}
{{- end -}}

{{- define "ktc-service.labels" -}}
app.kubernetes.io/name: {{ include "ktc-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: ktc
{{- end -}}

{{- define "ktc-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ktc-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "ktc-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "ktc-service.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
