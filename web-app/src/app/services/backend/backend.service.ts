import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class BackendService {
  constructor(private _http: HttpClient) {
  }

  baseUrl = environment.apiUrl

  getToken(code: string) {
    let url = this.baseUrl + 'exchangeToken?code=' + code;
    return this._http.get(url)
  }

  getApiKey() {
    let url = this.baseUrl + 'googleApiToken';
    return this._http.get(url)
  }

  getActivities(token: string) {
    let url = this.baseUrl + 'activityList?token=' + token;
    return this._http.get(url)
  }

  mergeActivities(activityDataToPost: any) {
    let url = this.baseUrl + 'merge';
    return this._http.post(url, activityDataToPost)
  }

  getGpx(token: string | null, id: string,name: string, type: string, time: number) {
    window.open(this.baseUrl + 'downloadGpx?token=' + token + '&id=' + id + '&time=' + time + '&name=' + name + '&type=' + type, '_blank');
  }
}
