{{- define "gw.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "gw.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "gw.name" . -}}
{{- end -}}
{{- end -}}

{{- define "gw.labels" -}}
app.kubernetes.io/name: {{ include "gw.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "gw.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gw.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
