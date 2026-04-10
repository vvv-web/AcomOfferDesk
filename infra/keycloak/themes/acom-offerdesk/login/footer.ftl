<#macro content>
  <div class="aod-app-footer">
    <div class="aod-app-footer__panel">
      <div class="aod-app-footer__section aod-app-footer__section--start">
        <span class="aod-app-footer__text">Created by «Цифровизация проектных задач»</span>
        <a
          class="aod-app-footer__icon-link"
          href="${properties.aodBitrixUrl!'/'}"
          target="_blank"
          rel="noreferrer"
          aria-label="Перейти в Bitrix24"
        >
          <img src="${url.resourcesPath}/img/bitrix24-logo.png?v=20260410-5" alt="Bitrix24" />
        </a>
      </div>

      <div class="aod-app-footer__brand">AcomOfferDesk</div>

      <div class="aod-app-footer__section aod-app-footer__section--end">
        <span class="aod-app-footer__text">По вопросам системы писать сюда</span>
        <a
          class="aod-app-footer__icon-link"
          href="${properties.aodSupportUrl!'/'}"
          target="_blank"
          rel="noreferrer"
          aria-label="Открыть MAX"
        >
          <img src="${url.resourcesPath}/img/max-logo-2025.png?v=20260410-5" alt="MAX" />
        </a>
      </div>
    </div>
  </div>
</#macro>
