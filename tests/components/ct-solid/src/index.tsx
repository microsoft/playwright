/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from "@solidjs/router";
import App from './App';
import './assets/index.css';

render(() => <Router><App /></Router>, document.getElementById('root')!);
