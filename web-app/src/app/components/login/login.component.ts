import {Component} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";

@Component({
  selector: 'login-component',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  STRAVA_AUTH_URL: string;

  message: string = 'This page will enable you to watch your Strava activities and merge them into one new activity (retaining the old ones). This project was brought to life, because my bike computer automatically records my rides and creates activities. Unfortunately it is not able to stop during a trip. As soon as it detects a break of 5 minutes or more, it will create a new activity. And I want to see my day trips as one, regardless of breaks during the trip. Hope it helps you, too.';
  displayMessage: string = this.message;

  constructor(private _route: ActivatedRoute) {
    let STRAVA_BASE_URL = 'http://www.strava.com/';
    // document.baseURI resolves the <base href> the build sets via
    // --base-href (e.g. /RideMergeBuddy/ on GitHub Pages, / in dev) against
    // the real origin - building this from window.location.hostname/port by
    // hand broke both on a portless https origin (empty port left a bare
    // "host:/activities") and on any base-href subpath (dropped it entirely).
    let STRAVA_REDIRECT_URL = document.baseURI + 'activities';
    let client_id = "66715";
    this.STRAVA_AUTH_URL = STRAVA_BASE_URL + 'oauth/authorize?client_id=' + client_id + '&approval_prompt=force&scope=activity:read_all,activity:write&response_type=code&redirect_uri=' + STRAVA_REDIRECT_URL;

    _route.queryParams.subscribe((params: Params) => {
      if (params.error) {
        this.displayMessage = 'ERROR: ' + params.error;
      } else {
        this.displayMessage = this.message;
      }
    })
  }
}
