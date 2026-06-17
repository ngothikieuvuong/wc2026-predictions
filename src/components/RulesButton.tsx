"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

export default function RulesButton({
  className = "btn-ghost",
  children = "📖 Luật chơi",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open && (
        <Modal title="📖 Luật chơi" onClose={() => setOpen(false)}>
            <div className="space-y-4 text-sm leading-relaxed text-white/80">
              <section>
                <h3 className="mb-1 font-bold text-grass">1. Cách chơi</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Vào tab <b>Đoán</b> → chọn tên → chọn trận → nhập tỉ số (đội nhà :
                    đội khách) → <b>Chốt lượt đoán</b>.
                  </li>
                  <li>
                    Mỗi lượt đoán <b>góp 20.000đ</b> vào quỹ. Mỗi người chỉ đoán{" "}
                    <b>1 lần/trận</b>, và <b>đóng khi trận bắt đầu</b>.
                  </li>
                  <li>
                    <b>Đoán càng nhiều trận → cơ hội trúng càng cao</b> (mỗi trận một
                    lượt, góp thêm 20.000đ).
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">2. Thế nào là trúng?</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Đoán <b>đúng y hệt tỉ số cuối trận</b> (đúng số bàn của cả hai
                    đội) thì trúng.
                  </li>
                  <li>
                    VD: đoán <b>3–0</b>, trận kết thúc đúng <b>3–0</b> → trúng. Nếu là
                    2–0 hay 3–1 → trượt.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">3. Chia thưởng (theo ngày)</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Quỹ = <b>tổng slot × 20.000đ</b> (gộp cả quỹ treo các ngày trước).
                  </li>
                  <li>
                    <b>Tỉ lệ trúng</b> = số tỉ số người đó trúng ÷ tổng số tỉ số trúng
                    của tất cả người thắng (trong ngày có người trúng).
                  </li>
                  <li>
                    <b>Mức ăn tối đa</b> = cộng mỗi ngày tham gia:{" "}
                    <b>số slot × số người chơi ngày đó × 20.000đ</b> → chơi nhiều
                    slot/nhiều ngày thì trần càng cao.
                  </li>
                  <li>
                    <b>Tiền tạm tính = mức ăn tối đa × tỉ lệ trúng.</b> Nếu tổng tạm
                    tính <b>vượt quỹ</b> → giảm đều cho khớp quỹ; nếu <b>chưa hết quỹ</b>{" "}
                    → phần dư giữ làm <b>quỹ treo</b> cộng dồn sang đợt sau (không hoàn
                    lại).
                  </li>
                </ul>

                <div className="mt-2 space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3 text-[13px]">
                  <p className="text-white/60">
                    Ví dụ: gộp 2 ngày <b>15 + 16/06</b>, mỗi ngày <b>9 người</b> chơi,
                    tổng <b>30 slot</b> → quỹ <b>600.000đ</b>.
                  </p>

                  <div>
                    <p className="mb-1 font-bold text-grass">
                      📌 VD 1 — chỉ ba Đức trúng, chơi ít → ăn ít, dư thì treo
                    </p>
                    <p>
                      ba Đức đặt <b>1 slot mỗi ngày</b>, trúng 1 tỉ số (duy nhất) → tỉ
                      lệ <b>100%</b>.
                    </p>
                    <p className="mt-1">
                      Mức ăn tối đa = (1×9×20k) + (1×9×20k) = <b>360.000đ</b>. Tạm tính
                      = 360k × 100% = 360k (&lt; 600k).
                    </p>
                    <p className="mt-1">
                      → ba Đức nhận <b className="text-neon">360.000đ</b>; còn{" "}
                      <b>240.000đ</b> giữ làm <b>quỹ treo</b> cho đợt sau.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-grass">
                      📌 VD 2 — chỉ Ny trúng, chơi nhiều → ôm hết quỹ
                    </p>
                    <p>
                      Ny đặt <b>3 slot (15) + 2 slot (16)</b>, trúng 1 tỉ số → tỉ lệ{" "}
                      <b>100%</b>.
                    </p>
                    <p className="mt-1">
                      Mức ăn tối đa = (3×9×20k) + (2×9×20k) = <b>900.000đ</b>. Tạm tính
                      900k &gt; quỹ 600k → giảm đều (×600/900).
                    </p>
                    <p className="mt-1">
                      → Ny nhận <b className="text-neon">600.000đ</b>. Hết quỹ, không
                      treo.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-grass">
                      📌 VD 3 — cả ba Đức & Ny trúng (mỗi người 1 tỉ số)
                    </p>
                    <p>Tỉ lệ <b>50% / 50%</b>.</p>
                    <p className="mt-1">
                      Tạm tính: ba Đức 360k×50% = 180k; Ny 900k×50% = 450k; tổng 630k
                      &gt; 600k → giảm đều (×600/630 ≈ 95,24%).
                    </p>
                    <p className="mt-1">
                      → ba Đức ≈ <b className="text-neon">171.000đ</b>; Ny ≈{" "}
                      <b className="text-neon">429.000đ</b>. Tổng 600k, không treo —
                      Ny chơi nhiều nên ăn nhiều hơn dù cùng trúng 1 tỉ số.
                    </p>
                  </div>
                </div>
              </section>
            </div>
        </Modal>
      )}
    </>
  );
}
