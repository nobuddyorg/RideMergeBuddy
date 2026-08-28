import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';

import {Activity, ActivityTableComponent} from './activity-table.component';
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {MatTableModule} from "@angular/material/table";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {Router, RouterModule, Routes} from "@angular/router";
import {LoadComponent} from "./load/load.component";
import {BackendService} from "../../services/backend/backend.service";
import {BehaviorSubject, of, Subject} from "rxjs";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {FormBuilder, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {AppComponent} from "../../app.component";
import {LoginComponent} from "../login/login.component";

describe('ActivityTableComponent', () => {
  let component: ActivityTableComponent;
  let fixture: ComponentFixture<ActivityTableComponent>;
  let backendService: BackendService;
  let router: Router;

  beforeEach(async () => {
    const routes: Routes = [
      {path: 'login', component: LoginComponent},
      {path: '**', component: ActivityTableComponent},
      {path: 'activities', component: ActivityTableComponent}
    ];

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        MatTableModule,
        MatCheckboxModule,
        RouterModule.forRoot(routes),
        MatProgressSpinnerModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatInputModule
      ],
      declarations: [ActivityTableComponent, LoadComponent],
    })
      .compileComponents();
    backendService = TestBed.inject(BackendService);
    router = TestBed.inject(Router);
  });

  beforeEach(() => {
    // Some tests below (e.g. "constructor with code") depend on
    // localStorage NOT already holding a token, but other tests in this
    // suite write 'token' to it without cleaning up - clear it here so
    // test order can't leak state between them.
    localStorage.clear();
    fixture = TestBed.createComponent(ActivityTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', fakeAsync(() => {
    expect(component).toBeTruthy();
    let response = new Subject<any>();
    spyOn(backendService, "getApiKey").and.returnValue(response)
    component.init();
    response.next({key: 'api'});
    tick(1);
    expect(component.key).toEqual('api');
  }));

  it('goto login on error', fakeAsync(() => {
    expect(component).toBeTruthy();
    let response = new Subject<any>();
    localStorage.setItem('anything', 'foobar');
    component.activitiesRetriever.activities.next({message: 'error'});
    tick(1);
    expect(localStorage.getItem('anything')).toEqual(null);
  }));

  it('should convert distances', () => {
    expect(component.meterToKilometer('123')).toEqual('123 m');
    expect(component.meterToKilometer('1234')).toEqual('1.234 km');
  })

  it('should convert times', () => {
    expect(component.secondsToHms('1')).toEqual('1 second');
    expect(component.secondsToHms('7')).toEqual('7 seconds');
    expect(component.secondsToHms('60')).toEqual('1 minute');
    expect(component.secondsToHms('70')).toEqual('1 minute, 10 seconds');
    expect(component.secondsToHms('700')).toEqual('11 minutes, 40 seconds');
    expect(component.secondsToHms('7000')).toEqual('1 hour, 56 minutes, 40 seconds');
    expect(component.secondsToHms('7200')).toEqual('2 hours');
    expect(component.secondsToHms('7201')).toEqual('2 hours, 1 second');
  })

  it('should return true if number of selected == number of rows', () => {
    expect(component.isAllSelected()).toBeTrue(); // no data, nothing selected

    let data: Activity[] = [
      {id: 1, type: 'ride', name: 'afternoon ride', date: '1-July-2021', elapsedTime: '10 seconds', timeInSeconds: 0}
    ];
    component.dataSource = data;

    expect(component.isAllSelected()).toBeFalse();
    component.masterToggle();
    expect(component.isAllSelected()).toBeTrue();
    component.masterToggle();
    expect(component.isAllSelected()).toBeFalse();
  })

  it('should set activities correctly', () => {
    let data: any[] = [
      {
        id: 1,
        type: 'ride',
        name: 'afternoon ride',
        date: '1-July-2021',
        elapsedTime: '10 seconds',
        startDateLocal: {year: '2021', month: '5', dayOfMonth: '15', hour: '1', minute: '45', second: '22'},
        startDate: {year: '2021', month: '5', dayOfMonth: '15', hour: '1', minute: '13', second: '21'},
        distance: '500',
        totalElevationGain: '1001',
        elevHigh: '20',
        elevLow: '0',
        movingTime: '1000000'
      }
    ];

    component.setActivities(data);

    expect(component.dataSource[0].date).toEqual('2021-5-15');
    expect(component.dataSource[0].distance).toEqual('500 m');
    expect(component.dataSource[0].movingTime).toEqual('277 hours, 46 minutes, 40 seconds');
  })

  it('merge button click does not fail', fakeAsync(() => {
    let data1: Activity = {
      id: 1,
      type: 'ride',
      name: 'afternoon ride',
      date: '1-July-2021',
      elapsedTime: '10 seconds',
      timeInSeconds: 0
    };
    let data2: Activity = {
      id: 2,
      type: 'canoeing',
      name: 'canoeing',
      date: '2-July-2021',
      elapsedTime: '1 hour',
      timeInSeconds: 0
    };
    component.selection.selected.push(data1);
    component.selection.selected.push(data2);
    spyOn(backendService, "mergeActivities")
      .withArgs({token: '123', name: '', mergeItems: {'1': 0, '2': 0}, type: 'ride'})
      .and.returnValue(of(''));

    component.loading = true;
    component.token = '123';
    expect(component.loading).toBeTrue();

    localStorage.clear();
    component.mergeButtonClicked();
    component.allElementsLoaded = true;
    tick(1000);
    expect(component.loading).toBeFalse();
  }))

  it('merge button click does not fail, with token set', fakeAsync(() => {
    let data1: Activity = {
      id: 1,
      type: 'ride',
      name: 'afternoon ride',
      date: '1-July-2021',
      elapsedTime: '10 seconds',
      timeInSeconds: 0
    };
    let data2: Activity = {
      id: 2,
      type: 'canoeing',
      name: 'canoeing',
      date: '2-July-2021',
      elapsedTime: '1 hour',
      timeInSeconds: 0
    };
    component.selection.selected.push(data1);
    component.selection.selected.push(data2);
    spyOn(backendService, "mergeActivities")
      .withArgs({token: '123', name: '', mergeItems: {'1': 0, '2': 0}, type: 'ride'})
      .and.returnValue(of(''));

    component.loading = true;
    component.token = '123';
    expect(component.loading).toBeTrue();

    localStorage.setItem('token', '123');
    component.mergeButtonClicked();
    component.allElementsLoaded = true;
    tick(1000);
    expect(component.loading).toBeFalse();
  }))

  it('detect merge status on externalId', () => {
    expect(component.isMerged({})).toBeFalse();
    expect(component.isMerged({externalId: 'something'})).toBeFalse();
    expect(component.isMerged({externalId: 'merged_activity_gpx_something'})).toBeTrue();
  })

  it('lazy load google maps to save money', () => {
    let element: any = {id: 0, map: {summaryPolyline: '1zP!@~~an'}}
    // keep this: see implementation
    // expect(component.getImageUrl(element)).toEqual('assets/images/staticmap.png');

    component.expandedElement = element;
    expect(component.getImageUrl(element)).toEqual("https://maps.googleapis.com/maps/api/staticmap?size=600x300&maptype=roadmap&key=&path=enc:1zP!@~~an");

    // keep this: see implementation
    // let element2: any = {id: 1, map: {summaryPolyline: 'schnulliwutz'}}
    // expect(component.getImageUrl(element2)).toEqual('assets/images/staticmap.png');
  })

  it('export function shall call backend service and then open link in new tab', () => {
    spyOn(window, "open").and.callFake(() => null);
    component.exportKomoot('123');

    expect(window.open).toHaveBeenCalled();
  })

  it('waitForDom', fakeAsync(() => {
    expect(component.allElementsLoaded).toBeFalse();
    component.numberOfRows = 0;
    component.waitForDom();
    tick(5000);
    expect(component.allElementsLoaded).toBeTrue();
  }))

  it('activities retreiver if token then set it', fakeAsync(() => {
    let spy = spyOn(component.activitiesRetriever, 'setActivitiesWithToken').withArgs('123').and.callThrough();
    component.activitiesRetriever.token.next('123');
    tick(1);
    expect(spy).toHaveBeenCalled();
  }))

  it('shall be in landscape mode if width > height', () => {
    spyOnProperty(window, 'innerWidth').and.returnValue(20);
    spyOnProperty(window, 'innerHeight').and.returnValue(10);
    window.dispatchEvent(new Event('resize'));
    component.ngAfterViewInit();

    expect(component.isLandscapeMode()).toBeTrue();
  })

  it('constructor with code', () => {
    spyOn(component.route.snapshot.queryParamMap, 'get').withArgs('code').and.returnValue('123');
    let spy = spyOn(component.activitiesRetriever, 'setTokenFromCode').withArgs('123').and.callThrough();
    new ActivityTableComponent(new FormBuilder(), component.backendService, component.activitiesRetriever, router, component.route);
    expect(spy).toHaveBeenCalled();
  })

  it('shall be in portrait mode if width < height', () => {
    spyOnProperty(window, 'innerWidth').and.returnValue(10);
    spyOnProperty(window, 'innerHeight').and.returnValue(20);
    window.dispatchEvent(new Event('resize'));
    component.ngAfterViewInit();

    expect(component.isLandscapeMode()).toBeFalse();
  })
});
